import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CUSTEIO_DATA_CONTRACT } from "../config/custeioDataContract";
import { CUSTEIO_DATA_SOURCE } from "../config/custeioDataSource";

const METRICS = [
  { key: "vlempenhado", label: "Empenhado" },
  { key: "vlliquidado", label: "Liquidado" },
  { key: "vlpago", label: "Pago" },
];

const PAGE_TABS = [
  { key: "overview", label: "Visão geral" },
  { key: "monthly", label: "Visão mensal" },
  { key: "distribution", label: "Distribuição" },
  { key: "trends", label: "Evolução" },
  { key: "matrix", label: "Matriz" },
  { key: "ugRanking", label: "Ranking UG" },
  { key: "alerts", label: "Alertas" },
  { key: "insights", label: "Dicas" },
];

const MONTH_SHORT_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const fmtCurrency = (value) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value || 0);

const fmtCompact = (value) =>
  new Intl.NumberFormat("pt-BR", {
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 1,
  }).format(value || 0);

const fmtPercent = (value) => {
  if (!Number.isFinite(value)) return "--";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
};

const normalize = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();

function aggregateBy(records, key, metricKey, limit = 8) {
  const totals = new Map();

  records.forEach((record) => {
    const mapKey = record[key] || "Não informado";
    totals.set(mapKey, (totals.get(mapKey) || 0) + Number(record[metricKey] || 0));
  });

  return [...totals.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

function buildPieSegments(items) {
  const total = items.reduce((acc, item) => acc + item.value, 0) || 1;
  let current = 0;
  const colors = ["#38BDF8", "#10B981", "#F59E0B", "#F97316", "#A78BFA", "#FB7185", "#22C55E", "#EAB308"];

  const segments = items.map((item, index) => {
    const start = current;
    const pct = (item.value / total) * 100;
    current += pct;

    return {
      ...item,
      pct,
      color: colors[index % colors.length],
      range: `${colors[index % colors.length]} ${start}% ${current}%`,
    };
  });

  return {
    segments,
    background: `conic-gradient(${segments.map((segment) => segment.range).join(", ")})`,
  };
}

function buildMatrixRows(records, groupKey, metricKey, years, limit, search) {
  const grouped = new Map();

  records.forEach((record) => {
    const key = record[groupKey] || "Não informado";
    const item = grouped.get(key) || { label: key, total: 0, byYear: {} };
    item.byYear[record.year] = (item.byYear[record.year] || 0) + record[metricKey];
    item.total += record[metricKey];
    grouped.set(key, item);
  });

  return [...grouped.values()]
    .filter((item) => normalize(item.label).includes(normalize(search)))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit)
    .map((item) => ({
      ...item,
      yearValues: years.map((year) => item.byYear[year] || 0),
    }));
}

function MetricCard({ label, value, secondary }) {
  return (
    <article className="bi-metric-card">
      <span className="bi-metric-label">{label}</span>
      <strong className="bi-metric-value">{fmtCurrency(value)}</strong>
      <span className="bi-metric-secondary">{secondary}</span>
    </article>
  );
}

function BarList({ title, items }) {
  const maxValue = items[0]?.value || 1;

  return (
    <section className="bi-panel">
      <div className="bi-panel-header">
        <h3>{title}</h3>
      </div>

      <div className="bi-bar-list">
        {items.map((item) => (
          <div key={item.label} className="bi-bar-item">
            <div className="bi-bar-copy">
              <strong>{item.label}</strong>
              <span>{fmtCurrency(item.value)}</span>
            </div>
            <div className="bi-bar-track">
              <div className="bi-bar-fill" style={{ width: `${(item.value / maxValue) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function TopRankingPanel({ title, items }) {
  return (
    <section className="bi-panel">
      <div className="bi-panel-header">
        <h3>{title}</h3>
      </div>

      <div className="bi-ranking-list">
        {items.map((item, index) => (
          <article key={item.label} className="bi-ranking-item">
            <span className="bi-ranking-position">{String(index + 1).padStart(2, "0")}</span>
            <div className="bi-ranking-copy">
              <strong>{item.label}</strong>
              <span>{fmtCurrency(item.value)}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function PiePanel({ title, items }) {
  const { segments, background } = buildPieSegments(items);

  return (
    <section className="bi-panel">
      <div className="bi-panel-header">
        <h3>{title}</h3>
      </div>

      <div className="bi-pie-layout">
        <div className="bi-pie-chart" style={{ background }} />
        <div className="bi-pie-legend">
          {segments.map((segment) => (
            <div key={segment.label} className="bi-pie-item">
              <span className="bi-pie-dot" style={{ background: segment.color }} />
              <div>
                <strong>{segment.label}</strong>
                <span>
                  {fmtPercent(segment.pct)} | {fmtCurrency(segment.value)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function buildLinePath(points, width, height, maxValue) {
  if (points.length === 0) return "";
  if (points.length === 1) {
    const y = height - (points[0].value / maxValue) * height;
    return `M 0 ${y} L ${width} ${y}`;
  }

  return points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * width;
      const y = height - (point.value / maxValue) * height;
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

function getSparseAxisLabels(periods) {
  if (periods.length <= 8) return periods;

  const maxLabels = 8;
  const step = Math.max(1, Math.ceil((periods.length - 1) / (maxLabels - 1)));

  return periods.filter((_, index) => index === 0 || index === periods.length - 1 || index % step === 0);
}

function formatPeriodLabel(periodKey) {
  const [year, month] = String(periodKey || "").split("-");
  const monthIndex = Number(month) - 1;
  const monthLabel = MONTH_SHORT_LABELS[monthIndex] || month;
  return `${monthLabel}/${year}`;
}

function TopUgTrendLinesPanel({
  title,
  periods,
  series,
  metricLabel,
  large = false,
  selectedPeriodKey,
  onSelectPeriod,
}) {
  const minWidth = large ? Math.max(980, periods.length * 78) : 720;
  const width = minWidth;
  const height = large ? 360 : 260;
  const [hoveredLine, setHoveredLine] = useState(null);
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const maxValue = Math.max(
    ...series.flatMap((line) => line.points.map((point) => point.value)),
    1
  );
  const axisLabels = getSparseAxisLabels(periods);

  const activeLine = hoveredLine ? series.find((line) => line.label === hoveredLine) : null;
  const displayedSeries = useMemo(() => {
    if (!selectedPeriodKey) return series;

    return [...series].sort((a, b) => {
      const aPoint = a.points.find((point) => point.periodKey === selectedPeriodKey)?.value || 0;
      const bPoint = b.points.find((point) => point.periodKey === selectedPeriodKey)?.value || 0;
      return bPoint - aPoint;
    });
  }, [selectedPeriodKey, series]);

  return (
    <section className="bi-panel">
      <div className="bi-panel-header">
        <h3>{title}</h3>
        <span>{metricLabel}</span>
      </div>

      {series.length > 0 ? (
        <div className={`bi-linechart-layout${large ? " is-large" : ""}`}>
          <div className={`bi-linechart-frame${large ? " is-scrollable" : ""}`}>
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className={`bi-linechart${large ? " is-large" : ""}`}
              preserveAspectRatio="none"
              style={large ? { minWidth: `${width}px` } : undefined}
            >
              {(large ? periods : axisLabels).map((period, index, list) => {
                const x = list.length === 1 ? width / 2 : (index / (list.length - 1)) * width;

                return (
                  <text
                    key={`top-label-${period.periodKey}`}
                    x={x}
                    y="18"
                    textAnchor="middle"
                    className="bi-linechart-top-label"
                  >
                    {period.fullLabel}
                  </text>
                );
              })}

              {[0.25, 0.5, 0.75, 1].map((step) => (
                <line
                  key={step}
                  x1="0"
                  x2={width}
                  y1={height - height * step}
                  y2={height - height * step}
                  className="bi-linechart-grid"
                />
              ))}

              {periods.map((period, index) => {
                const x = periods.length === 1 ? width / 2 : (index / (periods.length - 1)) * width;

                return (
                  <line
                    key={period.periodKey}
                    x1={x}
                    x2={x}
                    y1="0"
                    y2={height}
                    className="bi-linechart-grid bi-linechart-grid-vertical"
                  />
                );
              })}

              {selectedPeriodKey ? (
                <line
                  x1={
                    periods.length === 1
                      ? width / 2
                      : (periods.findIndex((period) => period.periodKey === selectedPeriodKey) / (periods.length - 1)) * width
                  }
                  x2={
                    periods.length === 1
                      ? width / 2
                      : (periods.findIndex((period) => period.periodKey === selectedPeriodKey) / (periods.length - 1)) * width
                  }
                  y1="0"
                  y2={height}
                  className="bi-linechart-focus-line"
                />
              ) : null}

              {series.map((line) => (
                <g
                  key={line.label}
                  onMouseEnter={() => setHoveredLine(line.label)}
                  onMouseLeave={() => {
                    setHoveredLine(null);
                    setHoveredPoint(null);
                  }}
                >
                  <path
                    d={buildLinePath(line.points, width, height, maxValue)}
                    fill="none"
                    stroke={line.color}
                    strokeWidth={hoveredLine === line.label ? "5" : "3"}
                    strokeOpacity={hoveredLine && hoveredLine !== line.label ? "0.2" : "1"}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {line.points.map((point, index) => {
                    const x = line.points.length === 1 ? width / 2 : (index / (line.points.length - 1)) * width;
                    const y = height - (point.value / maxValue) * height;

                    return (
                      <circle
                        key={`${line.label}-${point.periodKey}`}
                        cx={x}
                        cy={y}
                        r={hoveredLine === line.label ? 5 : 3}
                        fill={line.color}
                        fillOpacity={hoveredLine && hoveredLine !== line.label ? "0.2" : "1"}
                        onMouseEnter={() =>
                          setHoveredPoint({
                            lineLabel: line.label,
                            color: line.color,
                            periodKey: point.periodKey,
                            value: point.value,
                          })
                        }
                        onMouseLeave={() => setHoveredPoint(null)}
                      />
                    );
                  })}
                </g>
              ))}
            </svg>

            <div
              className={`bi-linechart-axis${large ? " is-large" : ""}`}
              style={large ? { minWidth: `${width}px` } : undefined}
            >
              {(large ? periods : axisLabels).map((period) => (
                <button
                  key={period.periodKey}
                  type="button"
                  className={`bi-linechart-axis-button${selectedPeriodKey === period.periodKey ? " is-active" : ""}`}
                  onClick={() => onSelectPeriod(selectedPeriodKey === period.periodKey ? null : period.periodKey)}
                >
                  {large ? period.fullLabel : period.shortLabel}
                </button>
              ))}
            </div>
          </div>

          <div className="bi-linechart-legend">
            {hoveredPoint ? (
              <div className="bi-linechart-tooltip">
                <span className="bi-linechart-swatch" style={{ background: hoveredPoint.color }} />
                <div>
                  <strong>{hoveredPoint.lineLabel}</strong>
                  <span>{hoveredPoint.periodKey}</span>
                  <span>{fmtCurrency(hoveredPoint.value)}</span>
                </div>
              </div>
            ) : activeLine ? (
              <div className="bi-linechart-tooltip">
                <span className="bi-linechart-swatch" style={{ background: activeLine.color }} />
                <div>
                  <strong>{activeLine.label}</strong>
                  <span>Linha destacada no gráfico</span>
                  <span>{fmtCurrency(activeLine.total)}</span>
                </div>
              </div>
            ) : null}

            {displayedSeries.map((line, index) => {
              const selectedValue =
                selectedPeriodKey !== null
                  ? line.points.find((point) => point.periodKey === selectedPeriodKey)?.value || 0
                  : null;

              return (
              <div
                key={line.label}
                className={`bi-linechart-legend-item${hoveredLine === line.label ? " is-active" : ""}`}
                onMouseEnter={() => setHoveredLine(line.label)}
                onMouseLeave={() => {
                  setHoveredLine(null);
                  setHoveredPoint(null);
                }}
              >
                <span className="bi-linechart-swatch" style={{ background: line.color }} />
                <div>
                  <strong>
                    {index + 1}. {line.label}
                  </strong>
                  <span>
                    {selectedPeriodKey ? `No mês: ${fmtCurrency(selectedValue)}` : fmtCurrency(line.total)}
                  </span>
                </div>
              </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="empty-state">Sem dados suficientes para montar o ranking em linhas no período selecionado.</div>
      )}
    </section>
  );
}

function AnnualBars({ items, metricLabel }) {
  const maxValue = Math.max(...items.map((item) => item.value), 1);

  return (
    <section className="bi-panel">
      <div className="bi-panel-header">
        <h3>Série anual</h3>
        <span>{metricLabel}</span>
      </div>

      <div className="bi-annual-chart">
        {items.map((item) => (
          <div key={item.year} className="bi-annual-item">
            <span className="bi-annual-value">{fmtCompact(item.value)}</span>
            <div className="bi-annual-column-track">
              <div className="bi-annual-column" style={{ height: `${(item.value / maxValue) * 100}%` }} />
            </div>
            <strong>{item.year}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function PeriodBars({ items, metricLabel, title, valueKey = "year" }) {
  const maxValue = Math.max(...items.map((item) => item.value), 1);

  return (
    <section className="bi-panel">
      <div className="bi-panel-header">
        <h3>{title}</h3>
        <span>{metricLabel}</span>
      </div>

      <div className="bi-annual-chart">
        {items.map((item) => (
          <div key={item[valueKey]} className="bi-annual-item">
            <span className="bi-annual-value">{fmtCompact(item.value)}</span>
            <div className="bi-annual-column-track">
              <div className="bi-annual-column" style={{ height: `${(item.value / maxValue) * 100}%` }} />
            </div>
            <strong>{item[valueKey]}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function VariationTable({ rows, title = "Variação anual", periodLabel = "Ano", valueKey = "year" }) {
  const withVariation = rows.map((current, index) => {
    const previous = rows[index - 1];
    const variation = previous?.value ? ((current.value - previous.value) / previous.value) * 100 : Number.NaN;

    return {
      ...current,
      variation,
    };
  });

  return (
    <section className="bi-panel">
      <div className="bi-panel-header">
        <h3>{title}</h3>
      </div>

      <div className="bi-table">
        <div className="bi-table-row bi-table-head">
          <span>{periodLabel}</span>
          <span>Total</span>
          <span>Variação</span>
        </div>
        {withVariation.map((row) => (
          <div key={row[valueKey]} className="bi-table-row">
            <span>{row[valueKey]}</span>
            <span>{fmtCurrency(row.value)}</span>
            <span className={row.variation >= 0 ? "positive" : "negative"}>{fmtPercent(row.variation)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function MatrixPanel({ title, rows, years, matrixSearch, onMatrixSearch }) {
  return (
    <section className="bi-panel">
      <div className="bi-panel-header">
        <h3>{title}</h3>
      </div>

      <div className="bi-subfilter-row">
        <input
          className="bi-search-input"
          placeholder="Pesquisar na matriz..."
          value={matrixSearch}
          onChange={(e) => onMatrixSearch(e.target.value)}
        />
      </div>

      <div className="bi-matrix-scroll">
        <div className="bi-matrix-table">
          <div className="bi-matrix-row bi-matrix-head">
            <span>Categoria</span>
            {years.map((year) => (
              <span key={year}>{year}</span>
            ))}
            <span>Total</span>
          </div>
          {rows.map((row) => (
            <div key={row.label} className="bi-matrix-row">
              <strong>{row.label}</strong>
              {row.yearValues.map((value, index) => (
                <span key={`${row.label}-${years[index]}`}>{fmtCompact(value)}</span>
              ))}
              <span>{fmtCurrency(row.total)}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function InsightCards({ cards }) {
  return (
    <section className="bi-panel">
      <div className="bi-panel-header">
        <h3>Dicas do painel</h3>
      </div>

      <div className="bi-insights">
        {cards.map((card) => (
          <article key={card.label}>
            <strong>{card.value}</strong>
            <span>{card.label}</span>
          </article>
        ))}
      </div>
    </section>
  );
}

function MonthlySummaryPanel({ title, firstPeriod, lastPeriod, metricLabel }) {
  const totalVariationValue = (lastPeriod?.value || 0) - (firstPeriod?.value || 0);
  const totalVariationPercent =
    firstPeriod?.value ? (totalVariationValue / firstPeriod.value) * 100 : Number.NaN;

  return (
    <section className="bi-panel">
      <div className="bi-panel-header">
        <h3>{title}</h3>
        <span>{metricLabel}</span>
      </div>

      {firstPeriod && lastPeriod ? (
        <>
          <div className="bi-narrative">
            <p>A comparação abaixo considera somente o valor do primeiro mês e o valor do último mês do período selecionado.</p>
          </div>
          <div className="bi-insights">
          <article>
            <strong>{firstPeriod.label}</strong>
            <span>{fmtCurrency(firstPeriod.value)}</span>
          </article>
          <article>
            <strong>{lastPeriod.label}</strong>
            <span>{fmtCurrency(lastPeriod.value)}</span>
          </article>
          <article>
            <strong>{fmtCurrency(totalVariationValue)}</strong>
            <span>Variação total em valor</span>
          </article>
          <article>
            <strong>{fmtPercent(totalVariationPercent)}</strong>
            <span>Variação total em porcentagem</span>
          </article>
          </div>
        </>
      ) : (
        <div className="empty-state">Sem meses suficientes para comparar o início e o fim do período.</div>
      )}
    </section>
  );
}

function MultiSelectChecklist({
  label,
  placeholder,
  options,
  selectedValues,
  searchValue,
  onSearchChange,
  onToggleValue,
  onClear,
  className = "",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const deferredSearchValue = useDeferredValue(searchValue);
  const filteredOptions = options.filter((option) => normalize(option.label).includes(normalize(deferredSearchValue)));
  const selectedLabels = options.filter((option) => selectedValues.includes(option.value)).map((option) => option.label);

  return (
    <div className={`bi-filter-group ${className}`}>
      <label>{label}</label>
      <div className="bi-multiselect">
        <button type="button" className="bi-multiselect-trigger" onClick={() => setIsOpen((open) => !open)}>
          <span className="bi-multiselect-trigger-text">
            {selectedLabels.length > 0 ? `${selectedLabels.length} selecionado(s)` : "Selecionar subelementos"}
          </span>
          <span className="bi-multiselect-trigger-icon">{isOpen ? "▲" : "▼"}</span>
        </button>

        {isOpen ? (
          <>
            <input
              className="bi-search-input"
              placeholder={placeholder}
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
            />
            <div className="bi-selection-summary">
              {selectedValues.length > 0 ? `${selectedValues.length} selecionado(s)` : "Nenhum selecionado"}
              {selectedValues.length > 0 ? (
                <button type="button" className="bi-inline-clear" onClick={onClear}>
                  Limpar
                </button>
              ) : null}
            </div>
            <div className="bi-checkbox-list">
              {filteredOptions.map((option) => {
                const checked = selectedValues.includes(option.value);
                return (
                  <label key={option.value} className={`bi-checkbox-item${checked ? " is-selected" : ""}`}>
                    <input type="checkbox" checked={checked} onChange={() => onToggleValue(option.value)} />
                    <span>{option.label}</span>
                  </label>
                );
              })}
              {filteredOptions.length === 0 ? <div className="bi-checkbox-empty">Nenhum subelemento encontrado.</div> : null}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function createOptions(items) {
  return items.map((item) => ({
    value: item.code,
    label: item.label,
  }));
}

function getVariationMeta(startValue, endValue) {
  if (startValue === 0 && endValue === 0) {
    return { percent: 0, label: "0,0%", isNew: false };
  }

  if (startValue === 0 && endValue > 0) {
    return { percent: Number.POSITIVE_INFINITY, label: "Novo", isNew: true };
  }

  const percent = ((endValue - startValue) / startValue) * 100;
  return { percent, label: fmtPercent(percent), isNew: false };
}

function buildGroupedVariationRows({ records, metricKey, startPeriodKey, endPeriodKey, grouping, threshold }) {
  if (!startPeriodKey || !endPeriodKey) return [];

  const grouped = new Map();

  const getLabel = (record) => {
    if (grouping === "unidade") return record.unidadeGestoraLabel;
    if (grouping === "elemento") return record.elementoLabel;
    return record.subelementoLabel;
  };

  records.forEach((record) => {
    if (record.periodKey !== startPeriodKey && record.periodKey !== endPeriodKey) return;

    const label = getLabel(record) || "Não informado";
    const current = grouped.get(label) || { label, startValue: 0, endValue: 0 };

    if (record.periodKey === startPeriodKey) current.startValue += record[metricKey];
    if (record.periodKey === endPeriodKey) current.endValue += record[metricKey];

    grouped.set(label, current);
  });

  return [...grouped.values()]
    .map((item) => {
      const variation = getVariationMeta(item.startValue, item.endValue);

      return {
        ...item,
        deltaValue: item.endValue - item.startValue,
        variationPercent: variation.percent,
        variationLabel: variation.label,
        exceededThreshold: variation.isNew || variation.percent >= threshold,
      };
    })
    .filter((item) => item.startValue > 0 || item.endValue > 0)
    .sort((a, b) => {
      if (a.exceededThreshold !== b.exceededThreshold) return a.exceededThreshold ? -1 : 1;
      if (!Number.isFinite(a.variationPercent)) return -1;
      if (!Number.isFinite(b.variationPercent)) return 1;
      if (a.variationPercent === b.variationPercent) return b.endValue - a.endValue;
      return b.variationPercent - a.variationPercent;
    });
}

function buildHistoricalAverageRows({ records, metricKey, endPeriodKey, grouping, threshold }) {
  if (!endPeriodKey) return [];

  const orderedPeriods = [...new Set(records.map((record) => record.periodKey))].sort((a, b) => a.localeCompare(b));
  const endIndex = orderedPeriods.indexOf(endPeriodKey);

  if (endIndex <= 0) return [];

  const previousPeriods = orderedPeriods.slice(Math.max(0, endIndex - 12), endIndex);
  if (previousPeriods.length === 0) return [];

  const getLabel = (record) => {
    if (grouping === "unidade") return record.unidadeGestoraLabel;
    if (grouping === "elemento") return record.elementoLabel;
    return record.subelementoLabel;
  };

  const grouped = new Map();

  const ensureGroup = (label) => {
    if (!grouped.has(label)) {
      grouped.set(label, {
        label,
        currentValue: 0,
        previousValues: new Map(previousPeriods.map((periodKey) => [periodKey, 0])),
      });
    }

    return grouped.get(label);
  };

  records.forEach((record) => {
    const label = getLabel(record) || "Não informado";
    const current = ensureGroup(label);

    if (record.periodKey === endPeriodKey) {
      current.currentValue += record[metricKey];
    } else if (current.previousValues.has(record.periodKey)) {
      current.previousValues.set(record.periodKey, current.previousValues.get(record.periodKey) + record[metricKey]);
    }
  });

  return [...grouped.values()]
    .map((item) => {
      const averageValue = [...item.previousValues.values()].reduce((acc, value) => acc + value, 0) / previousPeriods.length;
      const variation = getVariationMeta(averageValue, item.currentValue);

      return {
        label: item.label,
        averageValue,
        currentValue: item.currentValue,
        deltaValue: item.currentValue - averageValue,
        variationPercent: variation.percent,
        variationLabel: variation.label,
        exceededThreshold: variation.isNew || variation.percent >= threshold,
      };
    })
    .filter((item) => item.averageValue > 0 || item.currentValue > 0)
    .sort((a, b) => {
      if (a.exceededThreshold !== b.exceededThreshold) return a.exceededThreshold ? -1 : 1;
      if (!Number.isFinite(a.variationPercent)) return -1;
      if (!Number.isFinite(b.variationPercent)) return 1;
      if (a.variationPercent === b.variationPercent) return b.currentValue - a.currentValue;
      return b.variationPercent - a.variationPercent;
    });
}

function AlertTable({ title, rows, baseLabel, compareLabel, emptyMessage, totalValue = 0 }) {
  const alertsCount = rows.filter((r) => r.exceededThreshold).length;
  const avgVariation = rows.length > 0
    ? rows.reduce((acc, r) => acc + (Number.isFinite(r.variationPercent) ? r.variationPercent : 0), 0) / rows.length
    : 0;

  return (
    <section className="bi-panel">
      <div className="bi-panel-header">
        <div>
          <h3>{title}</h3>
          {rows.length > 0 && (
            <div className="bi-alert-summary-mini">
              <span>{alertsCount} em alerta</span>
              <span>•</span>
              <span>{avgVariation.toFixed(1)}% média de desvio</span>
            </div>
          )}
        </div>
      </div>

      {rows.length > 0 ? (
        <div className="bi-alert-table">
          <div className="bi-alert-row bi-alert-head">
            <span>Categoria</span>
            <span>{baseLabel}</span>
            <span>{compareLabel}</span>
            <span>Variação</span>
            <span>Impacto</span>
            <span>Diferença</span>
          </div>
          {rows.map((row) => {
            const compareVal = row.endValue ?? row.currentValue;
            const impact = totalValue > 0 ? (compareVal / totalValue) * 100 : 0;
            const isCritical = row.variationPercent > 50 || !Number.isFinite(row.variationPercent);
            const isHigh = row.variationPercent > 25;

            return (
              <div key={row.label} className={`bi-alert-row${row.exceededThreshold ? " is-alert" : ""}${isCritical ? " is-critical" : ""}`}>
                <div className="bi-alert-category">
                  {row.exceededThreshold && (
                    <span className={`bi-alert-badge ${isCritical ? "critical" : isHigh ? "high" : "warning"}`}>
                      {isCritical ? "Crítico" : isHigh ? "Alto" : "Atenção"}
                    </span>
                  )}
                  <strong>{row.label}</strong>
                </div>
                <span>{fmtCurrency(row.startValue ?? row.averageValue)}</span>
                <span>{fmtCurrency(compareVal)}</span>
                <span
                  className={`bi-alert-trend ${
                    Number.isFinite(row.variationPercent) ? (row.variationPercent >= 0 ? "positive" : "negative") : "positive"
                  }`}
                >
                  {row.variationPercent >= 0 ? "📈" : "📉"} {row.variationLabel}
                </span>
                <span className="bi-alert-impact">{impact.toFixed(1)}% do total</span>
                <span>{fmtCurrency(row.deltaValue)}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">{emptyMessage}</div>
      )}
    </section>
  );
}

export default function CusteioDashboard() {
  const [dataset, setDataset] = useState(null);
  const [lastManualUpdate, setLastManualUpdate] = useState(null);
  const [status, setStatus] = useState("Carregando painel...");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshInfo, setRefreshInfo] = useState("");
  const [selectedYear, setSelectedYear] = useState("all");
  const [selectedMetric, setSelectedMetric] = useState("vlliquidado");
  const [selectedElementos, setSelectedElementos] = useState([]);
  const [selectedSubelementos, setSelectedSubelementos] = useState([]);
  const [selectedUnidades, setSelectedUnidades] = useState([]);
  const [selectedPeriodStart, setSelectedPeriodStart] = useState("all");
  const [selectedPeriodEnd, setSelectedPeriodEnd] = useState("all");
  const [selectedRankingPeriod, setSelectedRankingPeriod] = useState(null);
  const [alertThreshold, setAlertThreshold] = useState(10);
  const [alertGrouping, setAlertGrouping] = useState("subelemento");
  const [activeTab, setActiveTab] = useState("overview");
  const [globalSearch, setGlobalSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [matrixSearch, setMatrixSearch] = useState("");
  const [elementoSearch, setElementoSearch] = useState("");
  const [subelementoSearch, setSubelementoSearch] = useState("");
  const [unidadeSearch, setUnidadeSearch] = useState("");
  const deferredMatrixSearch = useDeferredValue(matrixSearch);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const response = await fetch(`${CUSTEIO_DATA_SOURCE.cache.aggregatedJson}?t=${Date.now()}`);
        if (!response.ok) {
          throw new Error(`Falha ao carregar ${CUSTEIO_DATA_SOURCE.cache.aggregatedJson}: ${response.status}`);
        }

        const officialCache = await response.json();
        setDataset(officialCache);
        setStatus("");
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Não foi possível carregar os dados do painel de custeio.");
      } finally {
        setIsRefreshing(false);
      }
    };

    loadDashboard();
  }, []);

  const refreshDashboard = async () => {
    try {
      setIsRefreshing(true);
      setRefreshInfo("");
      setStatus("Atualizando dados do portal...");

      let syncCompleted = false;

      try {
        const syncResponse = await fetch("/api/sync-custeio", {
          method: "POST",
        });

        if (syncResponse.ok) {
          const syncResult = await syncResponse.json();
          if (syncResult.ok) {
            syncCompleted = true;
          }
        }
      } catch {
        syncCompleted = false;
      }

      setStatus("Recarregando cache atualizado...");
      const response = await fetch(`${CUSTEIO_DATA_SOURCE.cache.aggregatedJson}?t=${Date.now()}`);
      if (!response.ok) {
        throw new Error(`Falha ao carregar ${CUSTEIO_DATA_SOURCE.cache.aggregatedJson}: ${response.status}`);
      }

      const officialCache = await response.json();
      setDataset(officialCache);
      setLastManualUpdate(new Date());
      setStatus("");
      setRefreshInfo(
        syncCompleted
          ? "Dados oficiais sincronizados e painel recarregado."
          : "Painel recarregado com o cache publicado disponível."
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Não foi possível atualizar os dados do painel.");
    } finally {
      setIsRefreshing(false);
    }
  };

  const updatedAtLabel = useMemo(() => {
    const baseDate = dataset?.generatedAt ? new Date(dataset.generatedAt) : null;
    const dateToUse = lastManualUpdate || baseDate;

    if (!dateToUse) return "Cache local";

    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(dateToUse);
  }, [dataset, lastManualUpdate]);

  const dimensionLookup = useMemo(() => {
    if (!dataset) {
      return {
        elementos: new Map(),
        subelementos: new Map(),
        unidades: new Map(),
      };
    }

    return {
      elementos: new Map(dataset.elementos.map((item) => [item.code, item])),
      subelementos: new Map(dataset.subelementos.map((item) => [item.code, item])),
      unidades: new Map(dataset.unidades.map((item) => [item.code, item])),
    };
  }, [dataset]);

  const records = useMemo(() => {
    if (!dataset) return [];

    return dataset.facts.map(([year, month, elementoCode, subelementoCode, unidadeCode, vlempenhado, vlliquidado, vlpago]) => {
      const elemento = dimensionLookup.elementos.get(elementoCode);
      const subelemento = dimensionLookup.subelementos.get(subelementoCode);
      const unidade = dimensionLookup.unidades.get(unidadeCode);
      const periodKey = `${year}-${String(month).padStart(2, "0")}`;

      return {
        year,
        month,
        periodKey,
        monthLabel: dataset.periodLabels?.[periodKey] || periodKey,
        elementoCode,
        elementoLabel: elemento?.label || elementoCode,
        subelementoCode,
        subelementoLabel: subelemento?.label || subelementoCode,
        unidadeGestoraCode: unidadeCode,
        unidadeGestoraLabel: unidade?.label || unidadeCode,
        vlempenhado,
        vlliquidado,
        vlpago,
      };
    });
  }, [dataset, dimensionLookup]);

  const availableYears = useMemo(() => dataset?.availableYears || [], [dataset]);

  const periodOptions = useMemo(() => {
    if (!records.length) return [];

    return [...new Set(records.map((record) => record.periodKey))]
      .sort((a, b) => a.localeCompare(b))
      .map((periodKey) => ({
        value: periodKey,
        label: `${periodKey} - ${dataset?.periodLabels?.[periodKey] || periodKey}`,
      }));
  }, [dataset, records]);

  const dimensionOptions = useMemo(() => {
    if (!dataset) return { elementos: [], subelementos: [], unidades: [] };

    return {
      elementos: createOptions(dataset.elementos),
      subelementos: createOptions(dataset.subelementos),
      unidades: createOptions(dataset.unidades),
    };
  }, [dataset]);

  const historyScopedRecords = useMemo(() => {
    if (!records.length) return [];
    const searchText = normalize(appliedSearch);

    return records.filter((record) => {
      const yearOk = selectedYear === "all" || record.year === Number(selectedYear);
      const elementoOk = selectedElementos.length === 0 || selectedElementos.includes(record.elementoCode);
      const subelementoOk = selectedSubelementos.length === 0 || selectedSubelementos.includes(record.subelementoCode);
      const unidadeOk = selectedUnidades.length === 0 || selectedUnidades.includes(record.unidadeGestoraCode);
      const searchOk =
        !searchText ||
        [record.elementoLabel, record.subelementoLabel, record.unidadeGestoraLabel, record.periodKey, record.year]
          .map((item) => normalize(item))
          .some((item) => item.includes(searchText));

      return yearOk && elementoOk && subelementoOk && unidadeOk && searchOk;
    });
  }, [
    appliedSearch,
    records,
    selectedElementos,
    selectedSubelementos,
    selectedUnidades,
    selectedYear,
  ]);

  const visibleRecords = useMemo(() => {
    if (!records.length) return [];
    const searchText = normalize(appliedSearch);

    return records.filter((record) => {
      const yearOk = selectedYear === "all" || record.year === Number(selectedYear);
      const elementoOk = selectedElementos.length === 0 || selectedElementos.includes(record.elementoCode);
      const subelementoOk =
        selectedSubelementos.length === 0 || selectedSubelementos.includes(record.subelementoCode);
      const unidadeOk = selectedUnidades.length === 0 || selectedUnidades.includes(record.unidadeGestoraCode);
      const periodStartOk = selectedPeriodStart === "all" || record.periodKey >= selectedPeriodStart;
      const periodEndOk = selectedPeriodEnd === "all" || record.periodKey <= selectedPeriodEnd;
      const searchOk =
        !searchText ||
        [record.elementoLabel, record.subelementoLabel, record.unidadeGestoraLabel, record.periodKey, record.year]
          .map((item) => normalize(item))
          .some((item) => item.includes(searchText));

      return yearOk && elementoOk && subelementoOk && unidadeOk && periodStartOk && periodEndOk && searchOk;
    });
  }, [
    appliedSearch,
    records,
    selectedElementos,
    selectedPeriodEnd,
    selectedPeriodStart,
    selectedSubelementos,
    selectedUnidades,
    selectedYear,
  ]);

  const visiblePeriods = useMemo(
    () =>
      [...new Set(visibleRecords.map((record) => record.periodKey))]
        .sort((a, b) => a.localeCompare(b))
        .map((periodKey) => ({
          periodKey,
          label: `${periodKey} - ${dataset?.periodLabels?.[periodKey] || periodKey}`,
        })),
    [dataset, visibleRecords]
  );

  const totalMetrics = useMemo(
    () =>
      visibleRecords.reduce(
        (acc, record) => ({
          vlempenhado: acc.vlempenhado + record.vlempenhado,
          vlliquidado: acc.vlliquidado + record.vlliquidado,
          vlpago: acc.vlpago + record.vlpago,
        }),
        { vlempenhado: 0, vlliquidado: 0, vlpago: 0 }
      ),
    [visibleRecords]
  );

  const currentMetricLabel = METRICS.find((metric) => metric.key === selectedMetric)?.label || "";

  const yearlyVisibleTotals = useMemo(
    () =>
      availableYears.map((year) => {
        const yearRecords = visibleRecords.filter((record) => record.year === year);
        return {
          year,
          value: yearRecords.reduce((acc, record) => acc + record[selectedMetric], 0),
        };
      }),
    [availableYears, selectedMetric, visibleRecords]
  );

  const metricVariation =
    selectedYear !== "all"
      ? (() => {
          const current = yearlyVisibleTotals.find((item) => item.year === Number(selectedYear));
          const previous = yearlyVisibleTotals.find((item) => item.year === Number(selectedYear) - 1);
          return previous?.value ? ((current?.value || 0) - previous.value) / previous.value * 100 : Number.NaN;
        })()
      : Number.NaN;

  const topUnidades = useMemo(
    () => aggregateBy(visibleRecords, "unidadeGestoraLabel", selectedMetric, 10),
    [visibleRecords, selectedMetric]
  );
  const topSubelementos = useMemo(
    () => aggregateBy(visibleRecords, "subelementoLabel", selectedMetric, 7),
    [visibleRecords, selectedMetric]
  );
  const topElementos = useMemo(
    () => aggregateBy(visibleRecords, "elementoLabel", selectedMetric, 6),
    [visibleRecords, selectedMetric]
  );

  const monthlyVisibleTotals = useMemo(() => {
    if (!["monthly", "trends", "ugRanking"].includes(activeTab)) return [];

    const grouped = new Map();

    visibleRecords.forEach((record) => {
      const current = grouped.get(record.periodKey) || {
        periodKey: record.periodKey,
        label: `${record.periodKey} - ${record.monthLabel}`,
        value: 0,
      };

      current.value += record[selectedMetric];
      grouped.set(record.periodKey, current);
    });

    return [...grouped.values()].sort((a, b) => a.periodKey.localeCompare(b.periodKey));
  }, [activeTab, selectedMetric, visibleRecords]);

  const monthlyVariationRows = useMemo(
    () =>
      monthlyVisibleTotals.map((item) => ({
        period: item.periodKey,
        label: item.label,
        value: item.value,
      })),
    [monthlyVisibleTotals]
  );

  const topUgTrendSeries = useMemo(() => {
    if (activeTab !== "ugRanking") {
      return { periods: [], series: [] };
    }

    if (topUnidades.length === 0 || monthlyVisibleTotals.length === 0) {
      return { periods: [], series: [] };
    }

    const periods = monthlyVisibleTotals.map((item) => ({
      periodKey: item.periodKey,
      shortLabel: formatPeriodLabel(item.periodKey),
      fullLabel: formatPeriodLabel(item.periodKey),
    }));

    const colors = ["#38BDF8", "#10B981", "#F59E0B", "#F97316", "#A78BFA", "#FB7185", "#22C55E", "#EAB308", "#60A5FA", "#F472B6"];

    const periodValueMap = new Map();

    visibleRecords.forEach((record) => {
      if (!topUnidades.some((unit) => unit.label === record.unidadeGestoraLabel)) {
        return;
      }

      const mapKey = `${record.unidadeGestoraLabel}::${record.periodKey}`;
      periodValueMap.set(mapKey, (periodValueMap.get(mapKey) || 0) + record[selectedMetric]);
    });

    const series = topUnidades.map((unit, index) => {
      const points = periods.map((period) => ({
        periodKey: period.periodKey,
        value: periodValueMap.get(`${unit.label}::${period.periodKey}`) || 0,
      }));

      return {
        label: unit.label,
        total: unit.value,
        color: colors[index % colors.length],
        points,
      };
    });

    return { periods, series };
  }, [activeTab, monthlyVisibleTotals, selectedMetric, topUnidades, visibleRecords]);

  const monthlyRangeSummary = useMemo(() => {
    if (monthlyVariationRows.length === 0) {
      return { firstPeriod: null, lastPeriod: null };
    }

    return {
      firstPeriod: monthlyVariationRows[0],
      lastPeriod: monthlyVariationRows[monthlyVariationRows.length - 1],
    };
  }, [monthlyVariationRows]);

  const effectiveAlertStartPeriod = selectedPeriodStart === "all" ? visiblePeriods[0]?.periodKey || null : selectedPeriodStart;
  const effectiveAlertEndPeriod =
    selectedPeriodEnd === "all" ? visiblePeriods.at(-1)?.periodKey || null : selectedPeriodEnd;

  const periodComparisonRows = useMemo(
    () =>
      buildGroupedVariationRows({
        records: visibleRecords,
        metricKey: selectedMetric,
        startPeriodKey: effectiveAlertStartPeriod,
        endPeriodKey: effectiveAlertEndPeriod,
        grouping: alertGrouping,
        threshold: alertThreshold,
      }),
    [alertGrouping, alertThreshold, effectiveAlertEndPeriod, effectiveAlertStartPeriod, selectedMetric, visibleRecords]
  );

  const historicalAlertRows = useMemo(
    () =>
      buildHistoricalAverageRows({
        records: historyScopedRecords,
        metricKey: selectedMetric,
        endPeriodKey: effectiveAlertEndPeriod,
        grouping: alertGrouping,
        threshold: alertThreshold,
      }),
    [alertGrouping, alertThreshold, effectiveAlertEndPeriod, historyScopedRecords, selectedMetric]
  );

  const periodEndTotal = useMemo(() => {
    if (!effectiveAlertEndPeriod) return 0;
    return visibleRecords
      .filter((r) => r.periodKey === effectiveAlertEndPeriod)
      .reduce((acc, r) => acc + r[selectedMetric], 0);
  }, [effectiveAlertEndPeriod, selectedMetric, visibleRecords]);

  const alertInsightCards = useMemo(() => {
    const exceededPeriodCount = periodComparisonRows.filter((row) => row.exceededThreshold).length;
    const exceededHistoryCount = historicalAlertRows.filter((row) => row.exceededThreshold).length;
    const highestPeriodAlert = periodComparisonRows[0];
    const highestHistoryAlert = historicalAlertRows[0];

    return [
      { label: "Limite atual de alerta", value: `${alertThreshold.toFixed(0)}%` },
      { label: "Alertas entre períodos", value: String(exceededPeriodCount) },
      { label: "Alertas sobre média histórica", value: String(exceededHistoryCount) },
      { label: "Maior variação entre períodos", value: highestPeriodAlert ? highestPeriodAlert.label : "--" },
      { label: "Maior desvio histórico", value: highestHistoryAlert ? highestHistoryAlert.label : "--" },
      {
        label: "Comparação-base",
        value:
          effectiveAlertStartPeriod && effectiveAlertEndPeriod
            ? `${effectiveAlertStartPeriod} → ${effectiveAlertEndPeriod}`
            : "--",
      },
    ];
  }, [alertThreshold, effectiveAlertEndPeriod, effectiveAlertStartPeriod, historicalAlertRows, periodComparisonRows]);

  const years = yearlyVisibleTotals.map((item) => item.year);
  const matrixBySubelemento = useMemo(
    () =>
      activeTab === "matrix"
        ? buildMatrixRows(visibleRecords, "subelementoLabel", selectedMetric, years, 12, deferredMatrixSearch)
        : [],
    [activeTab, deferredMatrixSearch, selectedMetric, visibleRecords, years]
  );
  const matrixByUnidade = useMemo(
    () =>
      activeTab === "matrix"
        ? buildMatrixRows(visibleRecords, "unidadeGestoraLabel", selectedMetric, years, 12, deferredMatrixSearch)
        : [],
    [activeTab, deferredMatrixSearch, selectedMetric, visibleRecords, years]
  );

  const insightCards = useMemo(() => {
    const accumulated = yearlyVisibleTotals.reduce((acc, item) => acc + item.value, 0);
    const bestYear = [...yearlyVisibleTotals].sort((a, b) => b.value - a.value)[0];

    return [
      { label: "Ultimo ano disponivel no recorte", value: String(yearlyVisibleTotals.at(-1)?.year || "--") },
      { label: "Ano de maior valor na seleção atual", value: bestYear ? `${bestYear.year}` : "--" },
      { label: "Total acumulado da métrica selecionada", value: fmtCompact(accumulated) },
      { label: "UG líder na seleção atual", value: topUnidades[0]?.label || "--" },
      { label: "Subelemento dominante", value: topSubelementos[0]?.label || "--" },
      { label: "Elemento dominante", value: topElementos[0]?.label || "--" },
    ];
  }, [topElementos, topSubelementos, topUnidades, yearlyVisibleTotals]);

  const clearFilters = () => {
    setSelectedYear("all");
    setSelectedMetric("vlliquidado");
    setSelectedElementos([]);
    setSelectedSubelementos([]);
    setSelectedUnidades([]);
    setSelectedPeriodStart("all");
    setSelectedPeriodEnd("all");
    setSelectedRankingPeriod(null);
    setAlertThreshold(10);
    setAlertGrouping("subelemento");
    setGlobalSearch("");
    setAppliedSearch("");
    setMatrixSearch("");
    setElementoSearch("");
    setSubelementoSearch("");
    setUnidadeSearch("");
  };

  const toggleElemento = (value) => {
    setSelectedElementos((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
    );
  };

  const toggleSubelemento = (value) => {
    setSelectedSubelementos((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
    );
  };

  const toggleUnidade = (value) => {
    setSelectedUnidades((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
    );
  };

  const handleSearch = (e) => {
    if (e) e.preventDefault();
    setAppliedSearch(globalSearch);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  if (!dataset && status) return <div className="bi-loading">{status}</div>;
  if (!dataset) return <div className="bi-loading">Sem dados para exibir.</div>;

  return (
    <div className="bi-dashboard">
      <div className="bi-topbar">
        <div className="bi-topbar-actions">
          <Link to="/" className="bi-home-button">
            Home
          </Link>
        </div>
        <div className="bi-refresh-stack">
          <button type="button" className="bi-refresh-button" onClick={refreshDashboard} disabled={isRefreshing}>
            {isRefreshing ? "Atualizando..." : "Atualizar Dados"}
          </button>
          <span className="bi-topbar-status">Última atualização: {updatedAtLabel}</span>
          {refreshInfo ? <span className="bi-topbar-status">{refreshInfo}</span> : null}
        </div>
      </div>

      <section className="bi-hero">
        <div>
          <span className="section-kicker">Fonte oficial do portal</span>
          <h1>Análise das Despesas de Custeio</h1>
          <p>
            Painel alimentado pelos ZIPs mensais oficiais do Portal da Transparência de Santa Catarina, com filtros
            acumulados, seleção múltipla de subelementos e leitura mensal período a período.
          </p>
        </div>

        <div className="bi-filters bi-filters-grid">
          <div className="bi-filter-group bi-filter-group-wide">
            <label htmlFor="global-search">Pesquisa</label>
            <div className="bi-search-container">
              <input
                id="global-search"
                className="bi-search-input"
                placeholder="Escreva para pesquisar nos outros filtros..."
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                onKeyDown={handleSearchKeyDown}
              />
              <button
                type="button"
                className="bi-search-button"
                onClick={() => handleSearch()}
                aria-label="Pesquisar"
              >
                🔍
              </button>
            </div>
          </div>

          <div className="bi-filter-group">
            <label htmlFor="metric-select">Métrica</label>
            <select id="metric-select" value={selectedMetric} onChange={(e) => setSelectedMetric(e.target.value)}>
              {METRICS.map((metric) => (
                <option key={metric.key} value={metric.key}>
                  {metric.label}
                </option>
              ))}
            </select>
          </div>

          <div className="bi-filter-group">
            <label htmlFor="year-select">Ano</label>
            <select id="year-select" value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}>
              <option value="all">Todos os anos</option>
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <div className="bi-filter-group">
            <label htmlFor="period-start">Período inicial</label>
            <select id="period-start" value={selectedPeriodStart} onChange={(e) => setSelectedPeriodStart(e.target.value)}>
              <option value="all">Desde o início</option>
              {periodOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="bi-filter-group">
            <label htmlFor="period-end">Período final</label>
            <select id="period-end" value={selectedPeriodEnd} onChange={(e) => setSelectedPeriodEnd(e.target.value)}>
              <option value="all">Até o fim</option>
              {periodOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <MultiSelectChecklist
            label="Elementos"
            placeholder="Buscar código ou nome..."
            options={dimensionOptions.elementos}
            selectedValues={selectedElementos}
            searchValue={elementoSearch}
            onSearchChange={setElementoSearch}
            onToggleValue={toggleElemento}
            onClear={() => setSelectedElementos([])}
          />

          <MultiSelectChecklist
            label="Subelementos"
            placeholder="Buscar código ou nome..."
            options={dimensionOptions.subelementos}
            selectedValues={selectedSubelementos}
            searchValue={subelementoSearch}
            onSearchChange={setSubelementoSearch}
            onToggleValue={toggleSubelemento}
            onClear={() => setSelectedSubelementos([])}
          />

          <MultiSelectChecklist
            label="Unidades Gestoras"
            placeholder="Buscar código ou nome..."
            options={dimensionOptions.unidades}
            selectedValues={selectedUnidades}
            searchValue={unidadeSearch}
            onSearchChange={setUnidadeSearch}
            onToggleValue={toggleUnidade}
            onClear={() => setSelectedUnidades([])}
            className="bi-filter-group-wide"
          />

          <div className="bi-filter-actions">
            <button type="button" className="bi-clear-button" onClick={clearFilters}>
              Limpar filtros
            </button>
          </div>
        </div>
      </section>

      <section className="bi-tabs">
        {PAGE_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`bi-tab${activeTab === tab.key ? " active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </section>

      <section className="bi-metric-grid">
        <MetricCard
          label="Empenhado total"
          value={totalMetrics.vlempenhado}
          secondary={
            selectedPeriodStart === "all" && selectedPeriodEnd === "all"
              ? "Somatório do período filtrado"
              : `Período ${selectedPeriodStart === "all" ? periodOptions[0]?.value || "--" : selectedPeriodStart} até ${
                  selectedPeriodEnd === "all" ? periodOptions.at(-1)?.value || "--" : selectedPeriodEnd
                }`
          }
        />
        <MetricCard
          label="Liquidado total"
          value={totalMetrics.vlliquidado}
          secondary={selectedYear === "all" ? "Base principal do relatório" : `Variação anual: ${fmtPercent(metricVariation)}`}
        />
        <MetricCard
          label="Pago total"
          value={totalMetrics.vlpago}
          secondary={`Registros analisados: ${visibleRecords.length.toLocaleString("pt-BR")}`}
        />
      </section>

      {activeTab === "overview" && (
        <>
          <section className="bi-grid bi-grid-main">
            <AnnualBars items={yearlyVisibleTotals} metricLabel={currentMetricLabel} />
            <VariationTable rows={yearlyVisibleTotals} />
          </section>
          <section className="bi-grid">
            <TopRankingPanel title={`Ranking das 10 UGs com maior ${currentMetricLabel.toLowerCase()}`} items={topUnidades} />
            <BarList title={`Elementos com maior ${currentMetricLabel.toLowerCase()}`} items={topElementos} />
          </section>
        </>
      )}

      {activeTab === "monthly" && (
        <>
          <section className="bi-grid bi-grid-main">
            <PeriodBars items={monthlyVariationRows} metricLabel={currentMetricLabel} title="Série mensal" valueKey="period" />
            <VariationTable
              rows={monthlyVariationRows}
              title="Variação mensal"
              periodLabel="Mês"
              valueKey="period"
            />
          </section>
          <section className="bi-grid">
            <MonthlySummaryPanel
              title="Comparativo do período selecionado"
              firstPeriod={monthlyRangeSummary.firstPeriod}
              lastPeriod={monthlyRangeSummary.lastPeriod}
              metricLabel={currentMetricLabel}
            />
          </section>
        </>
      )}

      {activeTab === "distribution" && (
        <section className="bi-grid">
          <PiePanel title={`${currentMetricLabel} por subelemento`} items={topSubelementos} />
          <PiePanel title={`${currentMetricLabel} por unidade gestora`} items={topUnidades} />
        </section>
      )}

      {activeTab === "trends" && (
        <>
          <section className="bi-grid">
            <BarList title={`Subelementos com maior ${currentMetricLabel.toLowerCase()}`} items={topSubelementos} />
            <BarList title={`Unidades gestoras com maior ${currentMetricLabel.toLowerCase()}`} items={topUnidades} />
          </section>
          <section className="bi-grid">
            <section className="bi-panel">
              <div className="bi-panel-header">
                <h3>Série mensal</h3>
                <span>{monthlyVisibleTotals.length > 0 ? "Período a período" : "Sem registros mensais"}</span>
              </div>
              {monthlyVisibleTotals.length > 0 ? (
                <div className="bi-monthly-list">
                  {monthlyVisibleTotals.map((item) => (
                    <div key={item.periodKey} className="bi-monthly-item">
                      <strong>{item.label}</strong>
                      <span>{fmtCurrency(item.value)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">Sem registros mensais para os filtros selecionados.</div>
              )}
            </section>
            <section className="bi-panel">
              <div className="bi-panel-header">
                <h3>Estrutura oficial</h3>
              </div>
              <div className="bi-narrative">
                <p>Campos obrigatorios esperados no cache: {CUSTEIO_DATA_CONTRACT.requiredFields.join(", ")}</p>
                <p>Os valores exibidos saem dos ZIPs mensais oficiais publicados no Portal da Transparência.</p>
                <p>O período pode ser filtrado de 2021 até 2026 conforme a disponibilidade atual do portal.</p>
              </div>
            </section>
          </section>
        </>
      )}

      {activeTab === "matrix" && (
        <section className="bi-grid">
          <MatrixPanel
            title="Valores por subelemento e ano"
            rows={matrixBySubelemento}
            years={years}
            matrixSearch={matrixSearch}
            onMatrixSearch={setMatrixSearch}
          />
          <MatrixPanel
            title="Valores por unidade gestora e ano"
            rows={matrixByUnidade}
            years={years}
            matrixSearch={matrixSearch}
            onMatrixSearch={setMatrixSearch}
          />
        </section>
      )}

      {activeTab === "insights" && (
        <section className="bi-grid">
          <InsightCards cards={insightCards} />
          <TopRankingPanel title={`Ranking das 10 UGs no período selecionado`} items={topUnidades} />
        </section>
      )}

      {activeTab === "ugRanking" && (
        <section className="bi-grid bi-grid-single">
          <TopUgTrendLinesPanel
            title="Evolução mensal das 10 UGs que mais gastaram"
            periods={topUgTrendSeries.periods}
            series={topUgTrendSeries.series}
            metricLabel={currentMetricLabel}
            large
            selectedPeriodKey={selectedRankingPeriod}
            onSelectPeriod={setSelectedRankingPeriod}
          />
        </section>
      )}

      {activeTab === "alerts" && (
        <>
          <section className="bi-grid">
            <section className="bi-panel">
              <div className="bi-panel-header">
                <h3>Monitoramento contínuo</h3>
                <span>Leitura incremental sobre a base oficial</span>
              </div>

              <div className="bi-alert-controls">
                <div className="bi-filter-group">
                  <label htmlFor="alert-grouping">Agrupamento da leitura</label>
                  <select id="alert-grouping" value={alertGrouping} onChange={(e) => setAlertGrouping(e.target.value)}>
                    <option value="subelemento">Subelemento</option>
                    <option value="unidade">Unidade gestora</option>
                    <option value="elemento">Elemento</option>
                  </select>
                </div>

                <div className="bi-filter-group">
                  <label htmlFor="alert-threshold">Limite de alerta (%)</label>
                  <input
                    id="alert-threshold"
                    type="number"
                    min="0"
                    step="1"
                    className="bi-search-input"
                    value={alertThreshold}
                    onChange={(e) => setAlertThreshold(Math.max(0, Number(e.target.value) || 0))}
                  />
                </div>
              </div>

              <div className="bi-narrative">
                <p>
                  Esta trilha compara o primeiro e o último período do recorte atual e também verifica se o último
                  período ficou acima da média dos 12 meses anteriores.
                </p>
                <p>
                  Sugestão de leitura: 10% para alertas mensais e 50% para leituras anuais. O ajuste aqui afeta somente
                  esta aba.
                </p>
              </div>
            </section>

            <InsightCards cards={alertInsightCards} />
          </section>

          <section className="bi-grid bi-grid-single">
            <AlertTable
              title="Variações acima do limite entre o início e o fim do recorte"
              rows={periodComparisonRows.slice(0, 12)}
              baseLabel={effectiveAlertStartPeriod || "Início"}
              compareLabel={effectiveAlertEndPeriod || "Fim"}
              emptyMessage="Selecione um intervalo com ao menos dois períodos para montar os alertas de comparação."
              totalValue={periodEndTotal}
            />
            <AlertTable
              title="Desvios acima da média histórica"
              rows={historicalAlertRows.slice(0, 12)}
              baseLabel="Média 12 meses"
              compareLabel={effectiveAlertEndPeriod || "Período final"}
              emptyMessage="Ainda não há histórico suficiente para comparar o último período com a média anterior."
              totalValue={periodEndTotal}
            />
          </section>
        </>
      )}

      {activeTab === "insights" && (
        <section className="bi-grid">
          <section className="bi-panel">
            <div className="bi-panel-header">
              <h3>Origem e alimentação</h3>
            </div>
            <div className="bi-narrative">
              <p>Agora o painel usa o cache oficial consolidado do portal, sem depender das planilhas do Power BI.</p>
              <p>
                O script <code>scripts/build-custeio-cache.mjs</code> baixa os ZIPs mensais oficiais e gera{" "}
                <code>public/data/custeio-oficial.json</code>.
              </p>
              <p>
                A configuração da fonte está em <code>src/config/custeioDataSource.js</code>.
              </p>
            </div>
          </section>
        </section>
      )}
    </div>
  );
}

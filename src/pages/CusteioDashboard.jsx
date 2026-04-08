import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useCallback } from "react";
import MatrixPanelView from "../components/MatrixPanel";
import TopBar from "../components/TopBar";
import { CUSTEIO_DATA_CONTRACT } from "../config/custeioDataContract";
import { CUSTEIO_DATA_SOURCE } from "../config/custeioDataSource";
import { useAuth } from "../hooks/useAuth";
import { loadCusteioSyncPatch, mergeCusteioDataset, saveCusteioSyncPatch } from "../utils/custeioSyncSession";
import { buildMatrixRows as buildMatrixRowsHelper } from "../utils/matrix";

const METRICS = [
  { key: "vlempenhado", label: "Empenhamento" },
  { key: "vlliquidado", label: "Liquidação" },
  { key: "vlpago", label: "Pagamento" },
];

const CUSTEIO_SUBELEMENTO_PREFIX = "33";

const PAGE_TABS = [
  { key: "overview", label: "Visão Anual" },
  { key: "monthly", label: "Visão Mensal" },
  { key: "distribution", label: "Distribuição" },
  { key: "trends", label: "Ranking" },
  { key: "matrix", label: "Matriz" },
  { key: "ugRanking", label: "Evolução" },
  { key: "alerts", label: "Alertas" },
];

const MONTH_SHORT_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const IPCA_ANUAL_FALLBACK = {
  2021: 10.06,
  2022: 5.79,
  2023: 4.62,
  2024: 4.83,
  2025: 4.26,
  2026: 1.03,
};

const IPCA_MENSAL_FALLBACK = {
  "2021-01": 0.25,
  "2021-02": 0.86,
  "2021-03": 0.93,
  "2021-04": 0.31,
  "2021-05": 0.83,
  "2021-06": 0.53,
  "2021-07": 0.96,
  "2021-08": 0.87,
  "2021-09": 1.16,
  "2021-10": 1.25,
  "2021-11": 0.95,
  "2021-12": 0.73,
  "2022-01": 0.54,
  "2022-02": 1.01,
  "2022-03": 1.62,
  "2022-04": 1.06,
  "2022-05": 0.47,
  "2022-06": 0.67,
  "2022-07": -0.68,
  "2022-08": -0.36,
  "2022-09": -0.29,
  "2022-10": 0.59,
  "2022-11": 0.41,
  "2022-12": 0.62,
  "2023-01": 0.53,
  "2023-02": 0.84,
  "2023-03": 0.71,
  "2023-04": 0.61,
  "2023-05": 0.23,
  "2023-06": -0.08,
  "2023-07": 0.12,
  "2023-08": 0.23,
  "2023-09": 0.26,
  "2023-10": 0.24,
  "2023-11": 0.28,
  "2023-12": 0.56,
  "2024-01": 0.42,
  "2024-02": 0.83,
  "2024-03": 0.16,
  "2024-04": 0.38,
  "2024-05": 0.46,
  "2024-06": 0.21,
  "2024-07": 0.38,
  "2024-08": -0.02,
  "2024-09": 0.44,
  "2024-10": 0.56,
  "2024-11": 0.39,
  "2024-12": 0.52,
  "2025-01": 0.16,
  "2025-02": 1.31,
  "2025-03": 0.56,
  "2025-04": 0.43,
  "2025-05": 0.26,
  "2025-06": 0.24,
  "2025-07": 0.26,
  "2025-08": -0.11,
  "2025-09": 0.48,
  "2025-10": 0.09,
  "2025-11": 0.18,
  "2025-12": 0.33,
  "2026-01": 0.33,
  "2026-02": 0.70,
};

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

function aggregateBy(records, key, metricKey, limit = 10, groupOthers = false) {
  const totals = new Map();

  records.forEach((record) => {
    const val = Number(record[metricKey] || 0);
    const mapKey = record[key] || "Não informado";
    totals.set(mapKey, (totals.get(mapKey) || 0) + val);
  });

  const sorted = [...totals.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
  const totalGroups = sorted.length;

  if (!groupOthers || sorted.length <= limit) {
    const result = sorted.slice(0, limit);
    result.totalGroups = totalGroups;
    return result;
  }

  const top = sorted.slice(0, limit);
  const othersValue = sorted.slice(limit).reduce((acc, item) => acc + item.value, 0);
  const result = [
    ...top,
    { label: "Outras Despesas", value: othersValue },
  ];
  result.totalGroups = totalGroups;
  return result;
}

function buildPieSegments(items, selectedLabels = null, primaryLabel = null) {
  const total = items.reduce((acc, item) => acc + item.value, 0) || 1;
  let current = 0;
  // Professional BI color palette
  const colors = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#F97316", "#06B6D4"];

  const segments = items.map((item, index) => {
    const start = current;
    const pct = (item.value / total) * 100;
    current += pct;

    let color = colors[index % colors.length];
    
    const isSelected = selectedLabels?.has(item.label);
    const hasSelection = selectedLabels && selectedLabels.size > 0;
    const finalColor = hasSelection && !isSelected ? `${color}1A` : color;
    
    return {
      ...item,
      pct,
      color, // Original color for legend
      range: `${finalColor} ${start.toFixed(2)}% ${current.toFixed(2)}%`,
    };
  });

  return {
    segments,
    background: `conic-gradient(${segments.map((segment) => segment.range).join(", ")})`,
    activeSegment: segments.find((segment) => segment.label === primaryLabel) || null,
    highlightedSegments: selectedLabels ? segments.filter((segment) => selectedLabels.has(segment.label)) : [],
    total,
  };
}

function buildDistributionRelations(records, sourceKey, targetKey, metricKey) {
  const grouped = new Map();

  records.forEach((record) => {
    const sourceLabel = record[sourceKey] || "Não informado";
    const targetLabel = record[targetKey] || "Não informado";
    const current = grouped.get(sourceLabel) || new Map();
    current.set(targetLabel, (current.get(targetLabel) || 0) + record[metricKey]);
    grouped.set(sourceLabel, current);
  });

  return new Map(
    [...grouped.entries()].map(([sourceLabel, targetMap]) => {
      const total = [...targetMap.values()].reduce((acc, value) => acc + value, 0);
      const items = [...targetMap.entries()]
        .map(([label, value]) => ({
          label,
          value,
          pct: total > 0 ? (value / total) * 100 : 0,
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 3);

      return [sourceLabel, { total, items }];
    })
  );
}

function buildMatrixRows(records, groupKey, metricKey, years, limit, search, selectedCodes = null, codeKey = "") {
  const grouped = new Map();

  records.forEach((record) => {
    // Row filtering: only include selected codes if any are provided
    if (selectedCodes && !selectedCodes.includes(record[codeKey])) {
      return;
    }

    const key = record[groupKey] || "Não informado";
    const item = grouped.get(key) || { label: key, total: 0, byYear: {} };
    
    // Column filtering is handled by the 'years' array passed to map below
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

function BarList({ title, items, onClickItem, selectedItem, limitHeight = false }) {
  const maxValue = items[0]?.value || 1;

  return (
    <section className="bi-panel">
      <div className="bi-panel-header">
        <h3>{title}</h3>
      </div>

      <div className={`bi-bar-list${limitHeight ? " is-scrollable" : ""}`}>
        {items.map((item) => (
          <div
            key={item.label}
            className={`bi-bar-item${selectedItem === item.label ? " is-selected" : ""}${
              onClickItem ? " is-clickable" : ""
            }`}
            onClick={() => onClickItem?.(item.label === selectedItem ? null : item.label)}
          >
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

function TopRankingPanel({ title, items, limit = 10 }) {
  const displayedItems = items.slice(0, limit);
  const totalItems = items.totalGroups ?? items.length;

  return (
    <section className="bi-panel">
      <div className="bi-panel-header">
        <h3>{title}</h3>
      </div>

      <div className="bi-ranking-list">
        {displayedItems.map((item, index) => (
          <article key={item.label} className="bi-ranking-item">
            <span className="bi-ranking-position">{String(index + 1).padStart(2, "0")}</span>
            <div className="bi-ranking-copy">
              <strong>{item.label}</strong>
              <span>{fmtCurrency(item.value)}</span>
            </div>
          </article>
        ))}
        {totalItems > limit && (
          <div className="bi-ranking-footer">
            Exibindo top {limit} de {totalItems} itens.
          </div>
        )}
      </div>
    </section>
  );
}

function PiePanel({ title, items, panelKey, hoveredState, onHoverChange, relationInfo, relationTargetLabel, othersItems = [] }) {
  const safeHoverState = hoveredState && typeof hoveredState === "object" ? hoveredState : null;
  const hoveredLabel = safeHoverState?.source === panelKey ? safeHoverState.label : null;
  const isOthersSelected = hoveredLabel === "Outras Despesas";
  const relatedLabels =
    safeHoverState?.source && safeHoverState.source !== panelKey
      ? new Set(relationInfo?.items?.map((item) => item.label) || [])
      : null;
  const selectedLabels = hoveredLabel ? new Set([hoveredLabel]) : relatedLabels;
  const { segments, background, activeSegment, highlightedSegments } = buildPieSegments(
    items,
    selectedLabels,
    hoveredLabel
  );
  const hasCrossSelection = !hoveredLabel && highlightedSegments.length > 0;

  return (
    <section className="bi-panel">
      <div className="bi-panel-header">
        <h3>{title}</h3>
      </div>

      <div className="bi-pie-layout">
        <div className={`bi-pie-chart${activeSegment ? " is-active" : ""}${hasCrossSelection ? " is-related-active" : ""}`} style={{ background }}>
          <div className="bi-pie-center-copy">
            {activeSegment ? (
              <>
                <strong>{fmtPercent(activeSegment.pct)}</strong>
                <span>{fmtCurrency(activeSegment.value)}</span>
                <small>{activeSegment.label}</small>
              </>
            ) : hasCrossSelection ? (
              <>
                <strong>{highlightedSegments.length}</strong>
                <span>{fmtCurrency(relationInfo?.total || 0)}</span>
                <small>{relationTargetLabel}</small>
              </>
            ) : (
              <>
                <strong>{items.length}</strong>
                <span>itens no painel</span>
                <small>Clique para destacar</small>
              </>
            )}
          </div>
        </div>
        <div className="bi-pie-legend">
          {segments.map((segment) => {
            const isHovered = hoveredLabel === segment.label;
            const isOtherHovered = hoveredLabel && !isHovered;
            const isRelated = relatedLabels?.has(segment.label);

            return (
              <div
                key={segment.label}
                className={`bi-pie-item${isHovered ? " is-highlighted" : ""}${isOtherHovered ? " is-dimmed" : ""}${
                  isRelated ? " is-related" : ""
                }`}
                onClick={() =>
                  onHoverChange?.(
                    safeHoverState?.source === panelKey && safeHoverState?.label === segment.label
                      ? null
                      : { source: panelKey, label: segment.label }
                  )
                }
              >
                <span className="bi-pie-dot" style={{ background: segment.color }} />
                <div>
                  <strong>{segment.label}</strong>
                  <span className="bi-pie-meta">
                    {fmtPercent(segment.pct)} | {fmtCurrency(segment.value)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {isOthersSelected && othersItems.length > 0 ? (
        <div className="bi-pie-relationship-card">
          <strong>Composição de Outras Despesas</strong>
          <div className="bi-pie-relationship-list">
            {othersItems.slice(0, 10).map((item) => (
              <div key={`${panelKey}-others-${item.label}`} className="bi-pie-relationship-item">
                <span>{item.label}</span>
                <span>{fmtCurrency(item.value)}</span>
              </div>
            ))}
          </div>
          {othersItems.length > 10 ? (
            <div className="bi-pie-relationship-footnote">Exibindo 10 de {othersItems.length} itens agrupados em outras despesas.</div>
          ) : null}
          <button type="button" className="bi-pie-clear-selection" onClick={() => onHoverChange?.(null)}>
            Limpar seleção
          </button>
        </div>
      ) : safeHoverState && relationInfo ? (
        <div className="bi-pie-relationship-card">
          <strong>
            {safeHoverState.label}
            {" -> "}
            {relationTargetLabel}
          </strong>
          <div className="bi-pie-relationship-list">
            {relationInfo.items.map((item) => (
              <div key={`${safeHoverState.label}-${item.label}`} className="bi-pie-relationship-item">
                <span>{item.label}</span>
                <span>{fmtPercent(item.pct)} | {fmtCurrency(item.value)}</span>
              </div>
            ))}
          </div>
          <button type="button" className="bi-pie-clear-selection" onClick={() => onHoverChange?.(null)}>
            Limpar seleção
          </button>
        </div>
      ) : (
        <div className="bi-pie-relationship-card is-empty">
          Clique em um item para ver a relação entre subelemento e unidade gestora.
        </div>
      )}
    </section>
  );
}

function buildLinePath(points, width, height, maxValue, paddingX, paddingY) {
  if (points.length === 0) return "";
  
  const innerWidth = width - paddingX * 2;
  const innerHeight = height - paddingY * 2;

  if (points.length === 1) {
    const y = paddingY + innerHeight - (points[0].value / maxValue) * innerHeight;
    return `M ${paddingX} ${y} L ${width - paddingX} ${y}`;
  }

  return points
    .map((point, index) => {
      const x = paddingX + (index / (points.length - 1)) * innerWidth;
      const y = paddingY + innerHeight - (point.value / maxValue) * innerHeight;
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
  selectedSeriesLabel,
  onSelectSeries,
}) {
  // Configuração de dimensões
  const isMonthlySeries = periods.some((period) => String(period.periodKey).includes("-"));
  const minWidthPerPeriod = isMonthlySeries ? 64 : large ? 88 : 80;
  const chartWidth = Math.max(isMonthlySeries ? 760 : 680, periods.length * minWidthPerPeriod);
  const chartHeight = isMonthlySeries ? 320 : 340;
  
  const padding = { top: 26, right: 24, bottom: 56, left: 72 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;
  const pointDivisor = Math.max(periods.length - 1, 1);

  const [hoveredLine, setHoveredLine] = useState(null);
  const [hoveredPoint, setHoveredPoint] = useState(null);
  
  const maxValue = Math.max(
    ...series.flatMap((line) => line.points.map((point) => point.value)),
    1
  );
  
  const axisLabels = getSparseAxisLabels(periods);
  const activePeriod = hoveredPoint?.periodKey || selectedPeriodKey;
  const activePeriodLabel = activePeriod
    ? periods.find((period) => period.periodKey === activePeriod)?.fullLabel || activePeriod
    : null;

  const handleMouseEnterLine = (label) => setHoveredLine(label);
  const handleMouseLeaveLine = () => setHoveredLine(null);
  const ugPanelRef = useRef(null);
  const detailPanelRef = useRef(null);
  const handleTogglePeriod = (periodKey) => {
    if (!onSelectPeriod) return;
    onSelectPeriod(selectedPeriodKey === periodKey ? null : periodKey);
    window.requestAnimationFrame(() => {
      ugPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  };
  const getPointX = (index) => padding.left + (Math.max(index, 0) / pointDivisor) * innerWidth;
  const getPointY = (value) => padding.top + innerHeight - (value / maxValue) * innerHeight;

  const overview = useMemo(() => {
    const latestPeriod = periods[periods.length - 1];
    const focusPeriodKey = activePeriod || latestPeriod?.periodKey || null;
    const focusPeriod = periods.find((period) => period.periodKey === focusPeriodKey) || latestPeriod || null;
    const rankedSeries = [...series]
      .map((line) => {
        const focusPointIndex = focusPeriodKey ? line.points.findIndex((point) => point.periodKey === focusPeriodKey) : -1;
        const focusPoint = focusPointIndex >= 0 ? line.points[focusPointIndex] : null;
        const previousPoint = focusPointIndex > 0 ? line.points[focusPointIndex - 1] : null;
        const peakPoint = [...line.points].sort((a, b) => b.value - a.value)[0] || null;
        const delta = previousPoint?.value ? ((focusPoint?.value || 0) - previousPoint.value) / previousPoint.value * 100 : Number.NaN;

        return {
          ...line,
          focusValue: focusPoint?.value || 0,
          delta,
          peakPoint,
        };
      })
      .sort((a, b) => b.focusValue - a.focusValue);

    return {
      focusPeriod,
      latestPeriod,
      rankedSeries,
      leader: rankedSeries[0] || null,
      focusTotal: rankedSeries.reduce((acc, line) => acc + line.focusValue, 0),
    };
  }, [activePeriod, periods, series]);

  const tooltipData = hoveredPoint
    ? {
        title: hoveredPoint.lineLabel,
        subtitle: hoveredPoint.fullLabel || activePeriodLabel,
        value: fmtCurrency(hoveredPoint.value),
        accent: hoveredPoint.color,
      }
    : overview.leader
      ? {
          title: overview.leader.label,
          subtitle: activePeriodLabel || `Último período: ${overview.latestPeriod?.fullLabel || "--"}`,
          value: fmtCurrency(overview.leader.focusValue),
          accent: overview.leader.color,
        }
      : null;
  const topPeak = overview.rankedSeries
    .flatMap((line) => (line.peakPoint ? [{ label: line.label, point: line.peakPoint }] : []))
    .sort((a, b) => b.point.value - a.point.value)[0] || null;
  const selectedSeries = series.find((line) => line.label === selectedSeriesLabel) || overview.leader || null;
  const detailPeriodKey = activePeriod || overview.latestPeriod?.periodKey || null;
  const detailPeriodLabel = activePeriodLabel || overview.latestPeriod?.fullLabel || "--";
  const detailSubelements =
    selectedSeries?.topSubelementsByPeriod?.get(detailPeriodKey) ||
    selectedSeries?.topSubelementsOverall ||
    [];

  const handleSelectSeries = (label) => {
    onSelectSeries?.(label);
    window.requestAnimationFrame(() => {
      detailPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  };

  return (
    <section className="bi-panel">
      <div className="bi-panel-header">
        <h3>{title}</h3>
        <span className="bi-panel-subtitle">{metricLabel}</span>
      </div>

      {series.length > 0 ? (
        <div className="bi-evolution-container">
          <div className="bi-evolution-summary">
            <div className="bi-evolution-kpi">
              <span>Período em foco</span>
              <strong>{overview.focusPeriod?.fullLabel || "--"}</strong>
            </div>
            <div className="bi-evolution-kpi">
              <span>UG dominante</span>
              <strong>{overview.leader?.label || "--"}</strong>
            </div>
            <div className="bi-evolution-kpi">
              <span>Total das Top 10</span>
              <strong>{fmtCurrency(overview.focusTotal)}</strong>
            </div>
            <div className="bi-evolution-kpi">
              <span>Pico da série</span>
              <strong>{topPeak ? `${topPeak.label} · ${fmtCompact(topPeak.point.value)}` : "--"}</strong>
            </div>
          </div>

          <div className="bi-evolution-toolbar">
            <div className="bi-evolution-copy">
              <strong>Selecione um período</strong>
              <span>Clique nos marcadores do gráfico ou nos chips abaixo para congelar o ranking naquele ponto da série.</span>
            </div>
            {selectedPeriodKey && (
              <button type="button" className="bi-evolution-clear" onClick={() => onSelectPeriod?.(null)}>
                Limpar foco
              </button>
            )}
          </div>

          <div className="bi-evolution-periods">
            {(isMonthlySeries ? periods : axisLabels).map((period) => (
              <button
                key={period.periodKey}
                type="button"
                className={`bi-evolution-period-pill${selectedPeriodKey === period.periodKey ? " is-active" : ""}`}
                onClick={() => handleTogglePeriod(period.periodKey)}
              >
                {period.shortLabel}
              </button>
            ))}
          </div>

          {tooltipData && (
            <div className="bi-linechart-tooltip">
              <span className="bi-linechart-tooltip-dot" style={{ background: tooltipData.accent }} />
              <div>
                <strong>{tooltipData.title}</strong>
                <span>{tooltipData.subtitle}</span>
              </div>
              <strong className="bi-linechart-tooltip-value">{tooltipData.value}</strong>
            </div>
          )}

          <div className="bi-evolution-body">
          <div className="bi-evolution-chart-card">
          <div className="bi-linechart-scroll-container">
            <div className="bi-linechart-wrapper" style={{ width: `${chartWidth}px` }}>
              <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                className="bi-linechart-svg"
                preserveAspectRatio="xMinYMin meet"
              >
                {/* Eixo Y - Grades Horizontais e Valores */}
                {[0, 0.25, 0.5, 0.75, 1].map((step) => {
                  const y = padding.top + innerHeight - innerHeight * step;
                  return (
                    <g key={step}>
                      <line
                        x1={padding.left}
                        x2={chartWidth - padding.right}
                        y1={y}
                        y2={y}
                        stroke="rgba(148, 163, 184, 0.1)"
                        strokeWidth="1"
                      />
                      <text x={padding.left - 10} y={y + 4} textAnchor="end" className="bi-chart-axis-text">
                        {fmtCompact(maxValue * step)}
                      </text>
                    </g>
                  );
                })}

                {/* Eixo X - Guias Verticais e Rótulos */}
                {periods.map((period, index) => {
                  const isLabelVisible = isMonthlySeries || axisLabels.some((label) => label.periodKey === period.periodKey);
                  const x = getPointX(index);

                  return (
                    <g key={period.periodKey}>
                      <line
                        x1={x}
                        x2={x}
                        y1={padding.top}
                        y2={padding.top + innerHeight}
                        stroke="rgba(148, 163, 184, 0.05)"
                        strokeWidth="1"
                      />
                      {isLabelVisible && (
                        <text
                          x={x}
                          y={chartHeight - 20}
                          textAnchor="middle"
                          className="bi-chart-axis-text"
                        >
                          {period.shortLabel}
                        </text>
                      )}
                    </g>
                  );
                })}

                {/* Linha de Foco (Hover/Seleção) */}
                {activePeriod && (
                  <line
                    x1={getPointX(periods.findIndex((period) => period.periodKey === activePeriod))}
                    x2={getPointX(periods.findIndex((period) => period.periodKey === activePeriod))}
                    y1={padding.top}
                    y2={padding.top + innerHeight}
                    stroke="var(--accent-blue)"
                    strokeWidth="2"
                    strokeDasharray="4 4"
                    opacity="0.6"
                  />
                )}

                {/* Linhas de Dados */}
                {series.map((line) => {
                  const pathD = line.points
                    .map((point, index) => {
                      const x = getPointX(index);
                      return `${index === 0 ? "M" : "L"} ${x} ${getPointY(point.value)}`;
                    })
                    .join(" ");

                  const isDimmed = hoveredLine && hoveredLine !== line.label;

                  return (
                    <g
                      key={line.label}
                      onMouseEnter={() => handleMouseEnterLine(line.label)}
                      onMouseLeave={handleMouseLeaveLine}
                      className="bi-chart-series-group"
                    >
                      <path
                        d={pathD}
                        fill="none"
                        stroke={line.color}
                        strokeWidth={hoveredLine === line.label ? "4" : "2.5"}
                        strokeOpacity={isDimmed ? "0.14" : "0.95"}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="bi-chart-path"
                      />
                      {line.points.map((point, index) => {
                        const x = getPointX(index);
                        return (
                          <circle
                            key={`${line.label}-${point.periodKey}`}
                            cx={x}
                            cy={getPointY(point.value)}
                            r={hoveredLine === line.label ? 5.5 : 3.5}
                            fill={line.color}
                            fillOpacity={isDimmed ? "0.18" : "1"}
                            onMouseEnter={(e) => {
                              e.stopPropagation();
                              setHoveredPoint({
                                ...point,
                                lineLabel: line.label,
                                color: line.color,
                                fullLabel: periods[index]?.fullLabel || point.periodKey,
                              });
                            }}
                            onMouseLeave={() => setHoveredPoint(null)}
                            onClick={() => handleTogglePeriod(point.periodKey)}
                            className="bi-chart-point"
                          />
                        );
                      })}
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
          <div className="bi-evolution-footnote">
            <span>{isMonthlySeries ? "Rolagem horizontal liberada para acomodar todos os meses." : "Visão anual consolidada das 10 UGs dominantes."}</span>
            <span>{activePeriodLabel ? `Foco atual: ${activePeriodLabel}` : "Sem foco travado"}</span>
          </div>
          </div>

            <section ref={ugPanelRef} className="bi-evolution-ug-panel">
              <div className="bi-evolution-ug-header">
                <strong>UGs monitoradas</strong>
                <span>{activePeriod ? `Ranking em ${activePeriodLabel}` : "Último período disponível"}</span>
              </div>

              <div className="bi-linechart-legend">
                {overview.rankedSeries.map((line, index) => {
                  const deltaLabel = Number.isNaN(line.delta)
                    ? "Sem base anterior"
                    : `${line.delta >= 0 ? "+" : ""}${line.delta.toFixed(1)}% vs. anterior`;
                  const peakPeriodLabel = line.peakPoint
                    ? line.peakPoint.periodKey.includes("-")
                      ? formatPeriodLabel(line.peakPoint.periodKey)
                      : line.peakPoint.periodKey
                    : "--";

                  return (
                    <button
                      key={line.label}
                      type="button"
                      className={`bi-linechart-legend-item${hoveredLine === line.label || selectedSeries?.label === line.label ? " is-active" : ""}`}
                      onMouseEnter={() => setHoveredLine(line.label)}
                      onMouseLeave={handleMouseLeaveLine}
                      onClick={() => handleSelectSeries(line.label)}
                    >
                      <span className="bi-linechart-rank">{index + 1}</span>
                      <span className="bi-linechart-swatch" style={{ background: line.color }} />
                      <div className="bi-linechart-info">
                        <strong>{line.label}</strong>
                        <span>{activePeriod ? `No período: ${fmtCurrency(line.focusValue)}` : `Último período: ${fmtCurrency(line.focusValue)}`}</span>
                        <span>{deltaLabel}</span>
                        <span>Pico: {fmtCurrency(line.peakPoint?.value || 0)} em {peakPeriodLabel}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div ref={detailPanelRef} className="bi-evolution-detail-panel">
                <div className="bi-evolution-detail-header">
                  <strong>{selectedSeries?.label || "Selecione uma UG"}</strong>
                  <span>Top 10 subelementos em {detailPeriodLabel}</span>
                </div>
                <div className="bi-evolution-detail-list">
                  {detailSubelements.length > 0 ? (
                    detailSubelements.slice(0, 10).map((item, index) => (
                      <div key={`${selectedSeries?.label || "ug"}-${item.label}`} className="bi-evolution-detail-item">
                        <span className="bi-evolution-detail-rank">{String(index + 1).padStart(2, "0")}</span>
                        <div className="bi-evolution-detail-copy">
                          <strong>{item.label}</strong>
                          <span>{fmtCurrency(item.value)}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="bi-evolution-detail-empty">Sem subelementos para o recorte selecionado.</div>
                  )}
                </div>
              </div>
            </section>
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
        <h3>Série Anual</h3>
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

function VariationTable({
  rows,
  title = "Variação Anual",
  periodLabel = "Ano",
  valueKey = "year",
  showIPCA = false,
  ipcaAnnual = IPCA_ANUAL_FALLBACK,
  ipcaMonthly = IPCA_MENSAL_FALLBACK,
}) {
  const getDissonanceEmoji = (color) => {
    if (color === "positive") return "😊";
    if (color === "warning") return "😐";
    if (color === "negative") return "😢";
    return "";
  };

  const withVariation = rows.map((current, index) => {
      const previous = rows[index - 1];
      const variation = previous?.value ? ((current.value - previous.value) / previous.value) * 100 : Number.NaN;
      const rawIpcaValue =
        showIPCA && valueKey === "year"
          ? ipcaAnnual[String(current[valueKey]).substring(0, 4)]
          : showIPCA && valueKey === "period"
            ? ipcaMonthly[String(current[valueKey])]
            : null;
    const ipcaValue = Number.isFinite(rawIpcaValue) ? rawIpcaValue : null;
    const dissonance = ipcaValue !== null && !Number.isNaN(variation) ? variation - ipcaValue : null;

    let dissonanceColor = "";
    if (dissonance !== null) {
      if (dissonance <= 0) dissonanceColor = "positive";
      else if (dissonance <= 2) dissonanceColor = "warning";
      else dissonanceColor = "negative";
    }

    return {
      ...current,
      variation,
      ipcaValue,
      dissonance,
      dissonanceColor,
    };
  });
  const formatRowLabel = (row) => (valueKey === "period" ? formatPeriodLabel(row[valueKey]) : row[valueKey]);

  return (
    <section className="bi-panel">
      <div className="bi-panel-header">
        <h3>{title}</h3>
      </div>

      <div className={`bi-table${showIPCA ? " has-ipca" : ""}`}>
        <div className="bi-table-row bi-table-head">
          <span>{periodLabel}</span>
          <span>Total</span>
          <span>Variação</span>
          {showIPCA && <span>IPCA</span>}
          {showIPCA && <span>Dissonância</span>}
        </div>
        {withVariation.map((row) => (
          <div key={row[valueKey]} className="bi-table-row">
            <span>{formatRowLabel(row)}</span>
            <span>{fmtCurrency(row.value)}</span>
            <span className={row.variation >= 0 ? "positive" : "negative"}>{fmtPercent(row.variation)}</span>
            {showIPCA && (
              <span className="bi-table-subtext">
                {Number.isFinite(row.ipcaValue) ? `${row.ipcaValue.toFixed(2)}%` : "--"}
              </span>
            )}
            {showIPCA && (
              <span className={`bi-table-subtext ${row.dissonanceColor}`}>
                {Number.isFinite(row.dissonance)
                  ? (
                    <>
                      {row.dissonance.toFixed(2)}
                      <span className="bi-dissonance-emoji" aria-hidden="true">
                        {getDissonanceEmoji(row.dissonanceColor)}
                      </span>
                    </>
                  )
                  : "--"}
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function parseDateInputToPeriodKey(value) {
  if (!value) return "all";

  const normalized = String(value).trim();
  const match = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return "all";

  const [, dayText, monthText, yearText] = match;
  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);

  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) return "all";
  if (year < 1000 || month < 1 || month > 12 || day < 1 || day > 31) return "all";

  const candidateDate = new Date(year, month - 1, day);
  if (
    candidateDate.getFullYear() !== year ||
    candidateDate.getMonth() !== month - 1 ||
    candidateDate.getDate() !== day
  ) {
    return "all";
  }

  return `${yearText}-${monthText}`;
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

function InsightCards({ title = "Informações de Destaque", cards }) {
  return (
    <section className="bi-panel">
      <div className="bi-panel-header">
        <h3>{title}</h3>
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

function MonthlySummaryPanel({ title, firstPeriod, lastPeriod, metricLabel, firstLabel, lastLabel, firstValue, lastValue }) {
  const v1 = firstValue ?? firstPeriod?.value;
  const v2 = lastValue ?? lastPeriod?.value;
  const l1 = firstLabel ?? firstPeriod?.label ?? "--";
  const l2 = lastLabel ?? lastPeriod?.label ?? "--";

  const hasData = v1 !== undefined && v2 !== undefined && v1 !== null && v2 !== null;

  const totalVariationValue = hasData ? v2 - v1 : 0;
  const totalVariationPercent = hasData && v1 !== 0 ? (totalVariationValue / v1) * 100 : Number.NaN;

  const colorClass = totalVariationValue >= 0 ? "positive" : "negative";

  return (
    <section className="bi-panel">
      <div className="bi-panel-header">
        <h3>{title}</h3>
        <span>{metricLabel}</span>
      </div>

      <div className="bi-narrative">
        <p>A comparação abaixo considera somente o valor do primeiro período e o valor do último período do recorte selecionado.</p>
      </div>
      <div className="bi-insights">
        <article>
          <strong>{l1}</strong>
          <span>{hasData ? fmtCurrency(v1) : "-"}</span>
        </article>
        <article>
          <strong>{l2}</strong>
          <span>{hasData ? fmtCurrency(v2) : "-"}</span>
        </article>
        <article>
          <strong className={hasData ? colorClass : ""}>{hasData ? fmtCurrency(totalVariationValue) : "-"}</strong>
          <span>Variação Total em Valor</span>
        </article>
        <article>
          <strong className={hasData ? colorClass : ""}>{hasData ? fmtPercent(totalVariationPercent) : "-"}</strong>
          <span>Variação Total em Porcentagem</span>
        </article>
      </div>
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
  emptySelectionLabel = "Selecionar opções",
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
            {selectedLabels.length > 0 ? `${selectedLabels.length} selecionado(s)` : emptySelectionLabel}
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
  const { user } = useAuth();
  const fixedPeriodStartInput = "01/01/2021";
  const currentDateInput = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
  const [dataset, setDataset] = useState(null);
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [status, setStatus] = useState("Carregando painel...");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshInfo, setRefreshInfo] = useState("");
  const [selectedYear, setSelectedYear] = useState("all");
  const [selectedMetric, setSelectedMetric] = useState("vlempenhado");
  const [selectedElementos, setSelectedElementos] = useState([]);
  const [selectedSubelementos, setSelectedSubelementos] = useState([]);
  const [selectedUnidades, setSelectedUnidades] = useState([]);
  const [selectedSubelementInRanking, setSelectedSubelementInRanking] = useState(null);
  const [selectedUgInRanking, setSelectedUgInRanking] = useState(null);
  const [selectedPeriodStartInput, setSelectedPeriodStartInput] = useState(fixedPeriodStartInput);
  const [selectedPeriodEndInput, setSelectedPeriodEndInput] = useState(currentDateInput);
  const [selectedRankingPeriod, setSelectedRankingPeriod] = useState(null);
  const [selectedEvolutionUg, setSelectedEvolutionUg] = useState(null);
  const [evolutionType, setEvolutionType] = useState("monthly");
  const ugQuantity = 10; // Fixed at 10
  const [alertThreshold, setAlertThreshold] = useState(10);
  const [alertGrouping, setAlertGrouping] = useState("subelemento");
  const [distributionHover, setDistributionHover] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [globalSearch, setGlobalSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [matrixSearch, setMatrixSearch] = useState("");
  const [elementoSearch, setElementoSearch] = useState("");
  const [subelementoSearch, setSubelementoSearch] = useState("");
  const [unidadeSearch, setUnidadeSearch] = useState("");
  const deferredMatrixSearch = useDeferredValue(matrixSearch);

  const refreshDashboard = useCallback(async () => {
    try {
      setIsRefreshing(true);
      setRefreshInfo("");
      setStatus("Sincronizando base oficial do portal...");

      let syncCompleted = false;
      let syncPatch = null;

      try {
        const syncResponse = await fetch("/api/sync-custeio", {
          method: "POST",
        });

        if (syncResponse.ok) {
          const syncResult = await syncResponse.json();
          if (syncResult.ok) {
            syncCompleted = true;
            if (syncResult.cachePatch) {
              syncPatch = syncResult.cachePatch;
              saveCusteioSyncPatch(syncPatch);
            }
          }
        }
      } catch {
        syncCompleted = false;
      }

      setStatus("Recarregando base oficial sincronizada...");
      const response = await fetch(`${CUSTEIO_DATA_SOURCE.cache.aggregatedJson}?t=${Date.now()}`);
      if (!response.ok) {
        throw new Error(`Falha ao carregar ${CUSTEIO_DATA_SOURCE.cache.aggregatedJson}: ${response.status}`);
      }

      const officialCache = await response.json();
      const storedPatch = syncPatch || loadCusteioSyncPatch();
      const mergedDataset = storedPatch ? mergeCusteioDataset(officialCache, storedPatch) : officialCache;

      setDataset(mergedDataset);
      setLastSyncAt(storedPatch?.syncedAt ? new Date(storedPatch.syncedAt) : null);
      setStatus("");
      setRefreshInfo(
        syncPatch
          ? "Base atualizada no login com os dados mais recentes do portal."
          : syncCompleted
            ? "Base oficial sincronizada automaticamente com o Portal da Transparência."
            : "Painel recarregado com a base oficial publicada disponível."
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Não foi possível sincronizar os dados oficiais do painel.");
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    refreshDashboard();
  }, [refreshDashboard, user]);

  const updatedAtLabel = useMemo(() => {
    const baseDate = dataset?.syncedAt ? new Date(dataset.syncedAt) : dataset?.generatedAt ? new Date(dataset.generatedAt) : null;
    const dateToUse = lastSyncAt || baseDate;

    if (!dateToUse) return "Cache local";

    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(dateToUse);
  }, [dataset, lastSyncAt]);

  const latestPortalPeriodLabel = useMemo(() => {
    const latestPeriodKey = dataset?.sourceSummary?.latestPeriodAvailable;
    if (!latestPeriodKey) return "Não identificado";

    const periodLabel = dataset?.periodLabels?.[latestPeriodKey];
    return periodLabel ? `${periodLabel}/${latestPeriodKey.slice(0, 4)}` : latestPeriodKey;
  }, [dataset]);

  const syncCoverageLabel = useMemo(() => {
    const requested = dataset?.sourceSummary?.requestedPeriodsCount;
    const fetched = dataset?.sourceSummary?.fetchedPeriodsCount;
    const missing = dataset?.sourceSummary?.missingPeriodsCount;

    if (!Number.isFinite(requested) || !Number.isFinite(fetched)) return "Cobertura da base não informada";
    if (missing > 0) return `${fetched}/${requested} consultas ao portal concluídas, ${missing} pendente(s)`;
    return `${fetched}/${requested} consultas ao portal concluídas`;
  }, [dataset]);

  const aggregatedRecordsLabel = useMemo(() => {
    const recordsCount = dataset?.sourceSummary?.recordsAggregated ?? dataset?.facts?.length;
    if (!Number.isFinite(recordsCount)) return "Registros agregados não informados";
    return `${new Intl.NumberFormat("pt-BR").format(recordsCount)} registros agregados`;
  }, [dataset]);

  const dimensionLookup = useMemo(() => {
    if (!dataset) {
      return {
        elementos: new Map(),
        subelementos: new Map(),
        unidades: new Map(),
      };
    }

    const relevantFacts = dataset.facts.filter(([, , , subelementoCode]) =>
      String(subelementoCode || "").startsWith(CUSTEIO_SUBELEMENTO_PREFIX)
    );
    const relevantElementCodes = new Set(relevantFacts.map(([, , elementoCode]) => String(elementoCode)));
    const relevantSubelementCodes = new Set(relevantFacts.map(([, , , subelementoCode]) => String(subelementoCode)));
    const relevantUnidadeCodes = new Set(relevantFacts.map(([, , , , unidadeCode]) => String(unidadeCode)));

    return {
      elementos: new Map(
        dataset.elementos
          .filter((item) => relevantElementCodes.has(String(item.code)))
          .map((item) => [item.code, item])
      ),
      subelementos: new Map(
        dataset.subelementos
          .filter((item) => relevantSubelementCodes.has(String(item.code)))
          .map((item) => [item.code, item])
      ),
      unidades: new Map(
        dataset.unidades
          .filter((item) => relevantUnidadeCodes.has(String(item.code)))
          .map((item) => [item.code, item])
      ),
    };
  }, [dataset]);

  const records = useMemo(() => {
    if (!dataset) return [];

    return dataset.facts
      .filter(([, , , subelementoCode]) => String(subelementoCode || "").startsWith(CUSTEIO_SUBELEMENTO_PREFIX))
      .map(([year, month, elementoCode, subelementoCode, unidadeCode, vlempenhado, vlliquidado, vlpago]) => {
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

  const availableYears = useMemo(
    () => [...new Set(records.map((record) => record.year))].sort((a, b) => a - b),
    [records]
  );

  const selectedPeriodStart = useMemo(
    () => parseDateInputToPeriodKey(selectedPeriodStartInput),
    [selectedPeriodStartInput]
  );

  const selectedPeriodEnd = useMemo(
    () => parseDateInputToPeriodKey(selectedPeriodEndInput),
    [selectedPeriodEndInput]
  );

  const dimensionOptions = useMemo(() => {
    if (!dataset) return { elementos: [], subelementos: [], unidades: [] };

    return {
      elementos: createOptions([...dimensionLookup.elementos.values()]),
      subelementos: createOptions([...dimensionLookup.subelementos.values()]),
      unidades: createOptions([...dimensionLookup.unidades.values()]),
    };
  }, [dataset, dimensionLookup]);

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

  const currentMetricLabel = useMemo(() => {
    const metric = METRICS.find((m) => m.key === selectedMetric);
    return metric?.label || "";
  }, [selectedMetric]);

  const ipcaAnnual = useMemo(() => {
    const series = dataset?.ipcaAnnual;
    return series && Object.keys(series).length > 0 ? series : IPCA_ANUAL_FALLBACK;
  }, [dataset]);

  const ipcaMonthly = useMemo(() => {
    const series = dataset?.ipcaMonthly;
    return series && Object.keys(series).length > 0 ? series : IPCA_MENSAL_FALLBACK;
  }, [dataset]);

  const currentMetricNoun = useMemo(() => {
    if (selectedMetric === "vlempenhado") return "Empenhamento";
    if (selectedMetric === "vlliquidado") return "Liquidação";
    if (selectedMetric === "vlpago") return "Pagamento";
    return "";
  }, [selectedMetric]);

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

  const years = useMemo(
    () => yearlyVisibleTotals.filter((item) => item.value > 0).map((item) => item.year),
    [yearlyVisibleTotals]
  );

  const topUnidades = useMemo(
    () => aggregateBy(visibleRecords, "unidadeGestoraLabel", selectedMetric, 10, true),
    [visibleRecords, selectedMetric]
  );
  const topSubelementos = useMemo(
    () => aggregateBy(visibleRecords, "subelementoLabel", selectedMetric, 10, true),
    [visibleRecords, selectedMetric]
  );
  const topElementos = useMemo(
    () => aggregateBy(visibleRecords, "elementoLabel", selectedMetric, 5000),
    [visibleRecords, selectedMetric]
  );
  const fullUnidades = useMemo(
    () => aggregateBy(visibleRecords, "unidadeGestoraLabel", selectedMetric, 5000),
    [visibleRecords, selectedMetric]
  );
  const fullSubelementos = useMemo(
    () => aggregateBy(visibleRecords, "subelementoLabel", selectedMetric, 5000),
    [visibleRecords, selectedMetric]
  );

  const distributionRelations = useMemo(() => {
    if (activeTab !== "distribution") {
      return { bySubelemento: new Map(), byUnidade: new Map() };
    }

    return {
      bySubelemento: buildDistributionRelations(
        visibleRecords,
        "subelementoLabel",
        "unidadeGestoraLabel",
        selectedMetric
      ),
      byUnidade: buildDistributionRelations(
        visibleRecords,
        "unidadeGestoraLabel",
        "subelementoLabel",
        selectedMetric
      ),
    };
  }, [activeTab, selectedMetric, visibleRecords]);

  const rankingSubelementos = useMemo(() => {
    if (activeTab !== "trends") return [];
    let recs = visibleRecords;
    if (selectedUgInRanking) {
      recs = recs.filter((r) => r.unidadeGestoraLabel === selectedUgInRanking);
    }
    return aggregateBy(recs, "subelementoLabel", selectedMetric, 5000);
  }, [activeTab, selectedMetric, selectedUgInRanking, visibleRecords]);

  const rankingUnidades = useMemo(() => {
    if (activeTab !== "trends") return [];
    let recs = visibleRecords;
    if (selectedSubelementInRanking) {
      recs = recs.filter((r) => r.subelementoLabel === selectedSubelementInRanking);
    }
    return aggregateBy(recs, "unidadeGestoraLabel", selectedMetric, 5000);
  }, [activeTab, selectedMetric, selectedSubelementInRanking, visibleRecords]);

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

    if (topUnidades.length === 0) {
      return { periods: [], series: [] };
    }

    let periods = [];
    if (evolutionType === "monthly") {
      periods = monthlyVisibleTotals.map((item) => ({
        periodKey: item.periodKey,
        shortLabel: formatPeriodLabel(item.periodKey),
        fullLabel: formatPeriodLabel(item.periodKey),
      }));
    } else {
      periods = years.map((year) => ({
        periodKey: String(year),
        shortLabel: String(year),
        fullLabel: String(year),
      }));
    }

    if (periods.length === 0) return { periods: [], series: [] };

    const colors = ["#38BDF8", "#10B981", "#F59E0B", "#F97316", "#A78BFA", "#FB7185", "#22C55E", "#EAB308", "#60A5FA", "#F472B6"];

    const periodValueMap = new Map();

    visibleRecords.forEach((record) => {
      if (!topUnidades.slice(0, ugQuantity).some((unit) => unit.label === record.unidadeGestoraLabel)) {
        return;
      }

      const periodKey = evolutionType === "monthly" ? record.periodKey : String(record.year);
      const mapKey = `${record.unidadeGestoraLabel}::${periodKey}`;
      periodValueMap.set(mapKey, (periodValueMap.get(mapKey) || 0) + record[selectedMetric]);
    });

    const series = topUnidades.slice(0, ugQuantity).map((unit, index) => {
      const points = periods.map((period) => ({
        periodKey: period.periodKey,
        value: periodValueMap.get(`${unit.label}::${period.periodKey}`) || 0,
      }));

      const ugRecords = visibleRecords.filter((r) => r.unidadeGestoraLabel === unit.label);
      const topSubelementsOverall = aggregateBy(ugRecords, "subelementoLabel", selectedMetric, 10);
      const topSubelementsByPeriod = new Map(
        periods.map((period) => {
          const scopedRecords = ugRecords.filter((record) =>
            evolutionType === "monthly" ? record.periodKey === period.periodKey : String(record.year) === period.periodKey
          );
          return [period.periodKey, aggregateBy(scopedRecords, "subelementoLabel", selectedMetric, 10)];
        })
      );

      return {
        label: unit.label,
        total: unit.value,
        color: colors[index % colors.length],
        points,
        topSubelementsOverall,
        topSubelementsByPeriod,
      };
    });

    return { periods, series };
  }, [activeTab, monthlyVisibleTotals, selectedMetric, topUnidades, visibleRecords, ugQuantity, evolutionType, years]);

  const monthlyRangeSummary = useMemo(() => {
    if (monthlyVariationRows.length === 0) {
      return { firstPeriod: null, lastPeriod: null };
    }

    return {
      firstPeriod: monthlyVariationRows[0],
      lastPeriod: monthlyVariationRows[monthlyVariationRows.length - 1],
    };
  }, [monthlyVariationRows]);

  const annualRangeSummary = useMemo(() => {
    if (visibleRecords.length === 0) return null;

    const currentYears = [...new Set(visibleRecords.map((r) => r.year))].sort();
    if (currentYears.length < 2) return null;

    const firstYear = currentYears[0];
    const lastYear = currentYears[currentYears.length - 1];

    // Get exact range from visible records to ensure we compare first vs last year of selection
    const firstYearTotal = visibleRecords
      .filter((r) => r.year === firstYear)
      .reduce((acc, r) => acc + r[selectedMetric], 0);

    const lastYearTotal = visibleRecords
      .filter((r) => r.year === lastYear)
      .reduce((acc, r) => acc + r[selectedMetric], 0);

    const firstYearLabel = `Total de ${firstYear} (no período)`;
    const lastYearLabel = `Total de ${lastYear} (no período)`;

    return {
      firstLabel: firstYearLabel,
      lastLabel: lastYearLabel,
      firstValue: firstYearTotal,
      lastValue: lastYearTotal,
    };
  }, [selectedMetric, visibleRecords]);

  useEffect(() => {
    if (activeTab !== "ugRanking") return;
    if (topUgTrendSeries.series.length === 0) {
      setSelectedEvolutionUg(null);
      return;
    }

    if (selectedRankingPeriod) {
      const leaderForPeriod = [...topUgTrendSeries.series]
        .map((line) => ({
          label: line.label,
          value: line.points.find((point) => point.periodKey === selectedRankingPeriod)?.value || 0,
        }))
        .sort((a, b) => b.value - a.value)[0];

      if (leaderForPeriod?.label) {
        setSelectedEvolutionUg(leaderForPeriod.label);
        return;
      }
    }

    if (!selectedEvolutionUg || !topUgTrendSeries.series.some((line) => line.label === selectedEvolutionUg)) {
      setSelectedEvolutionUg(topUgTrendSeries.series[0]?.label || null);
    }
  }, [activeTab, selectedEvolutionUg, selectedRankingPeriod, topUgTrendSeries.series]);

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

  const selectedYears = useMemo(() => {
    if (selectedYear !== "all") return [Number(selectedYear)];
    return years;
  }, [selectedYear, years]);

  const matrixBySubelemento = useMemo(
    () =>
      activeTab === "matrix"
        ? buildMatrixRowsHelper(
            visibleRecords,
            "subelementoLabel",
            selectedMetric,
            selectedYears,
            5000,
            normalize,
            deferredMatrixSearch,
            selectedSubelementos.length > 0 ? selectedSubelementos : null,
            "subelementoCode"
          )
        : [],
    [activeTab, deferredMatrixSearch, selectedMetric, visibleRecords, selectedYears, selectedSubelementos]
  );
  const matrixByUnidade = useMemo(
    () =>
      activeTab === "matrix"
        ? buildMatrixRowsHelper(
            visibleRecords,
            "unidadeGestoraLabel",
            selectedMetric,
            selectedYears,
            5000,
            normalize,
            deferredMatrixSearch,
            selectedUnidades.length > 0 ? selectedUnidades : null,
            "unidadeGestoraCode"
          )
        : [],
    [activeTab, deferredMatrixSearch, selectedMetric, visibleRecords, selectedYears, selectedUnidades]
  );

  const annualHighlights = useMemo(() => {
    const accumulated = yearlyVisibleTotals.reduce((acc, item) => acc + item.value, 0);
    const bestYear = [...yearlyVisibleTotals].sort((a, b) => b.value - a.value)[0];

    return [
      { label: "Ano de Maior Valor na Seleção", value: bestYear ? `${bestYear.year}` : "--" },
      { label: `Total da ${currentMetricLabel}`, value: fmtCurrency(accumulated) },
      { label: "UG Dominante", value: topUnidades[0]?.label || "--" },
      { label: "Subelemento Dominante", value: topSubelementos[0]?.label || "--" },
      { label: "Elemento Dominante", value: topElementos[0]?.label || "--" },
    ];
  }, [topElementos, topSubelementos, topUnidades, yearlyVisibleTotals, currentMetricLabel]);

  const monthlyHighlightsMaxMonth = useMemo(() => {
    if (monthlyVariationRows.length === 0) return [];

    const sortedByValue = [...monthlyVariationRows].sort((a, b) => b.value - a.value);
    const topMonth = sortedByValue[0];
    if (!topMonth) return [];

    const getTopForMonth = (periodKey) => {
      const recs = visibleRecords.filter((r) => r.periodKey === periodKey);
      const units = aggregateBy(recs, "unidadeGestoraLabel", selectedMetric, 1);
      const subs = aggregateBy(recs, "subelementoLabel", selectedMetric, 1);
      const elems = aggregateBy(recs, "elementoLabel", selectedMetric, 1);
      const total = recs.reduce((acc, r) => acc + r[selectedMetric], 0);
      return { unit: units[0]?.label || "--", sub: subs[0]?.label || "--", elem: elems[0]?.label || "--", total };
    };

    const topMonthDetails = getTopForMonth(topMonth.period);

    return [
      { label: "Mês de Maior Gasto na Seleção", value: formatPeriodLabel(topMonth.period) },
      { label: "Total no Mês de Maior Gasto", value: fmtCurrency(topMonthDetails.total) },
      { label: "UG Dominante no Mês", value: topMonthDetails.unit },
      { label: "Subelemento Dominante no Mês", value: topMonthDetails.sub },
      { label: "Elemento Dominante no Mês", value: topMonthDetails.elem },
    ];
  }, [monthlyVariationRows, selectedMetric, visibleRecords]);

  const monthlyHighlightsMaxVariation = useMemo(() => {
    if (monthlyVariationRows.length === 0) return [];

    // Calculate variations between months
    const withVariation = monthlyVariationRows.map((current, index) => {
      const previous = monthlyVariationRows[index - 1];
      const delta = previous?.value ? current.value - previous.value : 0;
      const pct = previous?.value ? (delta / previous.value) * 100 : 0;
      return {
        ...current,
        delta,
        pct,
        prevLabel: previous?.period ? formatPeriodLabel(previous.period) : "--",
      };
    });
    
    // Sort by absolute variation to find the most significant change
    const sortedByVariation = [...withVariation].sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
    const topVarMonth = sortedByVariation[0];
    if (!topVarMonth) return [];

    const getTopForMonth = (periodKey) => {
      const recs = visibleRecords.filter((r) => r.periodKey === periodKey);
      const units = aggregateBy(recs, "unidadeGestoraLabel", selectedMetric, 1);
      const subs = aggregateBy(recs, "subelementoLabel", selectedMetric, 1);
      const elems = aggregateBy(recs, "elementoLabel", selectedMetric, 1);
      return { unit: units[0]?.label || "--", sub: subs[0]?.label || "--", elem: elems[0]?.label || "--" };
    };

    const topVarDetails = getTopForMonth(topVarMonth.period);

    return [
      {
        label: "Maior Variação",
        value: `${topVarMonth.prevLabel} → ${formatPeriodLabel(topVarMonth.period)}`,
      },
      { label: "Variação em Valor", value: fmtCurrency(topVarMonth.delta) },
      { label: "Variação em Percentual", value: fmtPercent(topVarMonth.pct) },
      { label: "UG Dominante na Variação", value: topVarDetails.unit },
      { label: "Subelemento na Variação", value: topVarDetails.sub },
    ];
  }, [monthlyVariationRows, selectedMetric, visibleRecords]);

  const clearFilters = () => {
    setSelectedYear("all");
    setSelectedMetric("vlempenhado");
    setSelectedElementos([]);
    setSelectedSubelementos([]);
    setSelectedUnidades([]);
    setSelectedSubelementInRanking(null);
    setSelectedUgInRanking(null);
    setSelectedPeriodStartInput(fixedPeriodStartInput);
    setSelectedPeriodEndInput(currentDateInput);
    setSelectedRankingPeriod(null);
    setSelectedEvolutionUg(null);
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
      <TopBar title="Monitoramento do Custeio">
        <div className="bi-refresh-stack">
          <span className="bi-topbar-status">
            {isRefreshing ? "Sincronizando automaticamente com o portal..." : `Última sincronização: ${updatedAtLabel}`}
          </span>
          <span className="bi-topbar-status">Base do portal até: {latestPortalPeriodLabel}</span>
          <span className="bi-topbar-status">{syncCoverageLabel}</span>
          <span className="bi-topbar-status">{aggregatedRecordsLabel}</span>
          {refreshInfo ? <span className="bi-topbar-status">{refreshInfo}</span> : null}
        </div>
      </TopBar>

      <section className="bi-hero">
        <div className="bi-hero-content">
          <h1>Monitoramento do Custeio</h1>
          <p>
            Dados da execução orçamentária do grupo de natureza de despesa “Outras Despesas Correntes” (empenhamento, liquidação e pagamento).
          </p>
        </div>

        <div className="bi-filters-container">
          <div className="bi-filters-grid">
            <div className="bi-filter-group bi-filter-group-wide">
              <label htmlFor="global-search">Pesquisa Global</label>
              <div className="bi-search-container">
                <input
                  id="global-search"
                  className="bi-search-input"
                  placeholder="Pesquisar em todos os filtros..."
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

            <div className="bi-filter-group bi-filter-group-wide">
              <label htmlFor="metric-select">Fase da Despesa</label>
              <select id="metric-select" value={selectedMetric} onChange={(e) => setSelectedMetric(e.target.value)}>
                {METRICS.map((metric) => (
                  <option key={metric.key} value={metric.key}>
                    {metric.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="bi-filter-group">
              <label htmlFor="period-start">Período Inicial</label>
              <input
                id="period-start"
                type="text"
                inputMode="numeric"
                className="bi-filter-input"
                placeholder="dd/mm/aaaa"
                value={selectedPeriodStartInput}
                onChange={(e) => setSelectedPeriodStartInput(e.target.value)}
              />
            </div>

            <div className="bi-filter-group">
              <label htmlFor="period-end">Período Final</label>
              <input
                id="period-end"
                type="text"
                inputMode="numeric"
                className="bi-filter-input"
                placeholder="dd/mm/aaaa"
                value={selectedPeriodEndInput}
                onChange={(e) => setSelectedPeriodEndInput(e.target.value)}
              />
            </div>

            <div className="bi-filter-group bi-filter-group-wide">
              <MultiSelectChecklist
                label="Elementos"
                placeholder="Buscar código ou nome..."
                emptySelectionLabel="Selecionar Elemento"
                options={dimensionOptions.elementos}
                selectedValues={selectedElementos}
                searchValue={elementoSearch}
                onSearchChange={setElementoSearch}
                onToggleValue={toggleElemento}
                onClear={() => setSelectedElementos([])}
              />
            </div>

            <div className="bi-filter-group bi-filter-group-wide">
              <MultiSelectChecklist
                label="Subelementos"
                placeholder="Buscar código ou nome..."
                emptySelectionLabel="Selecionar Subelemento"
                options={dimensionOptions.subelementos}
                selectedValues={selectedSubelementos}
                searchValue={subelementoSearch}
                onSearchChange={setSubelementoSearch}
                onToggleValue={toggleSubelemento}
                onClear={() => setSelectedSubelementos([])}
              />
            </div>

            <div className="bi-filter-group bi-filter-group-wide">
              <MultiSelectChecklist
                label="Unidades Gestoras"
                placeholder="Buscar código ou nome..."
                emptySelectionLabel="Selecionar Unidade Gestora"
                options={dimensionOptions.unidades}
                selectedValues={selectedUnidades}
                searchValue={unidadeSearch}
                onSearchChange={setUnidadeSearch}
                onToggleValue={toggleUnidade}
                onClear={() => setSelectedUnidades([])}
              />
            </div>

            <div className="bi-filter-group bi-filter-group-wide">
              <button
                type="button"
                className="bi-clear-button"
                onClick={clearFilters}
                style={{ width: "100%", height: "48px", marginTop: "12px" }}
              >
                Limpar Filtros
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="bi-dashboard-content">
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
            label="Empenhamento"
            value={totalMetrics.vlempenhado}
          />
          <MetricCard
            label="Liquidação"
            value={totalMetrics.vlliquidado}
          />
          <MetricCard
            label="Pagamento"
            value={totalMetrics.vlpago}
          />
        </section>

        {activeTab === "overview" && (
          <>
              <section className="bi-grid bi-grid-main">
                <AnnualBars items={yearlyVisibleTotals} metricLabel={currentMetricLabel} />
                <VariationTable rows={yearlyVisibleTotals} showIPCA ipcaAnnual={ipcaAnnual} ipcaMonthly={ipcaMonthly} />
              </section>
            <section className="bi-grid">
              <TopRankingPanel title={`10 UGs com Maior Valor ${currentMetricLabel}`} items={topUnidades} />
              <TopRankingPanel title={`10 Subelementos com Maior Valor ${currentMetricLabel}`} items={topSubelementos} />
            </section>
            <section className="bi-grid">
              <MonthlySummaryPanel
                title="Comparativo do Período Selecionado"
                firstLabel={annualRangeSummary?.firstLabel}
                lastLabel={annualRangeSummary?.lastLabel}
                firstValue={annualRangeSummary?.firstValue}
                lastValue={annualRangeSummary?.lastValue}
                metricLabel={currentMetricLabel}
              />
              <InsightCards cards={annualHighlights} />
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
                  showIPCA
                  ipcaAnnual={ipcaAnnual}
                  ipcaMonthly={ipcaMonthly}
                />
            </section>
            <section className="bi-grid">
              <MonthlySummaryPanel
                title="Comparativo do Período Selecionado"
                firstPeriod={monthlyRangeSummary.firstPeriod}
                lastPeriod={monthlyRangeSummary.lastPeriod}
                metricLabel={currentMetricLabel}
              />
              <InsightCards title="Informações de Destaque" cards={monthlyHighlightsMaxMonth} />
            </section>
            <section className="bi-grid bi-grid-single">
              <InsightCards title="Maior Variação" cards={monthlyHighlightsMaxVariation} />
            </section>
          </>
        )}

        {activeTab === "distribution" && (
          <section className="bi-grid">
            <PiePanel
              title={`${currentMetricNoun} por Subelemento`}
              items={topSubelementos}
              panelKey="subelemento"
              hoveredState={distributionHover}
              onHoverChange={setDistributionHover}
              othersItems={fullSubelementos.slice(10)}
              relationInfo={
                distributionHover
                  ? distributionHover.source === "subelemento"
                    ? distributionRelations.bySubelemento.get(distributionHover.label)
                    : distributionRelations.byUnidade.get(distributionHover.label)
                  : null
              }
              relationTargetLabel={
                distributionHover?.source === "unidade" ? "Subelementos relacionados" : "UGs relacionadas"
              }
            />
            <PiePanel
              title={`${currentMetricNoun} por Unidade Gestora`}
              items={topUnidades}
              panelKey="unidade"
              hoveredState={distributionHover}
              onHoverChange={setDistributionHover}
              othersItems={fullUnidades.slice(10)}
              relationInfo={
                distributionHover
                  ? distributionHover.source === "unidade"
                    ? distributionRelations.byUnidade.get(distributionHover.label)
                    : distributionRelations.bySubelemento.get(distributionHover.label)
                  : null
              }
              relationTargetLabel={
                distributionHover?.source === "subelemento" ? "UGs relacionadas" : "Subelementos relacionados"
              }
            />
          </section>
        )}

        {activeTab === "trends" && (
          <section className="bi-grid">
            <BarList
              title={`Subelementos com Maior ${currentMetricNoun}`}
              items={rankingSubelementos}
              onClickItem={setSelectedSubelementInRanking}
              selectedItem={selectedSubelementInRanking}
              limitHeight
            />
            <BarList
              title={`Unidades Gestoras com Maior ${currentMetricNoun}`}
              items={rankingUnidades}
              onClickItem={setSelectedUgInRanking}
              selectedItem={selectedUgInRanking}
              limitHeight
            />
          </section>
        )}

        {activeTab === "matrix" && (
          <section className="bi-grid bi-grid-single">
            <MatrixPanelView
              title="Valores por Subelemento e Ano"
              rows={matrixBySubelemento}
              years={years}
              matrixSearch={matrixSearch}
              onMatrixSearch={setMatrixSearch}
              fmtCompact={fmtCompact}
              fmtCurrency={fmtCurrency}
            />
            <MatrixPanelView
              title="Valores por Unidade Gestora e Ano"
              rows={matrixByUnidade}
              years={years}
              matrixSearch={matrixSearch}
              onMatrixSearch={setMatrixSearch}
              fmtCompact={fmtCompact}
              fmtCurrency={fmtCurrency}
            />
          </section>
        )}

        {activeTab === "ugRanking" && (
          <>
            <div className="bi-tab-header">
              <div className="bi-filter-group">
                <label>Frequência da Evolução</label>
                <div className="bi-toggle-group">
                  <button
                    type="button"
                    className={evolutionType === "monthly" ? "is-active" : ""}
                    onClick={() => setEvolutionType("monthly")}
                  >
                    Série Mensal
                  </button>
                  <button
                    type="button"
                    className={evolutionType === "annual" ? "is-active" : ""}
                    onClick={() => setEvolutionType("annual")}
                  >
                    Série Anual
                  </button>
                </div>
              </div>
            </div>

            <section className="bi-grid bi-grid-single">
              <TopUgTrendLinesPanel
                title={`Evolução ${evolutionType === "monthly" ? "Mensal" : "Anual"} (Top 10 UGs)`}
                periods={topUgTrendSeries.periods}
                series={topUgTrendSeries.series}
                metricLabel={currentMetricLabel}
                large
                selectedPeriodKey={selectedRankingPeriod}
                onSelectPeriod={setSelectedRankingPeriod}
                selectedSeriesLabel={selectedEvolutionUg}
                onSelectSeries={setSelectedEvolutionUg}
              />
            </section>
          </>
        )}

        {activeTab === "alerts" && (
          <>
            <section className="bi-grid">
              <section className="bi-panel">
                <div className="bi-panel-header">
                  <h3>Monitoramento Contínuo</h3>
                  <span>Leitura incremental sobre a base oficial</span>
                </div>

                <div className="bi-alert-controls">
                  <div className="bi-filter-group">
                    <label htmlFor="alert-grouping">Agrupamento da Leitura</label>
                    <select id="alert-grouping" value={alertGrouping} onChange={(e) => setAlertGrouping(e.target.value)}>
                      <option value="subelemento">Subelemento</option>
                      <option value="unidade">Unidade Gestora</option>
                      <option value="elemento">Elemento</option>
                    </select>
                  </div>

                  <div className="bi-filter-group">
                    <label htmlFor="alert-threshold">Limite de Alerta (%)</label>
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
                title="Variações Acima do Limite entre o Início e o Fim do Recorte"
                rows={periodComparisonRows.slice(0, 12)}
                baseLabel={effectiveAlertStartPeriod || "Início"}
                compareLabel={effectiveAlertEndPeriod || "Fim"}
                emptyMessage="Selecione um intervalo com ao menos dois períodos para montar os alertas de comparação."
                totalValue={periodEndTotal}
              />
              <AlertTable
                title="Desvios Acima da Média Histórica"
                rows={historicalAlertRows.slice(0, 12)}
                baseLabel="Média 12 Meses"
                compareLabel={effectiveAlertEndPeriod || "Período Final"}
                emptyMessage="Ainda não há histórico suficiente para comparar o último período com a média anterior."
                totalValue={periodEndTotal}
              />
            </section>
          </>
        )}
      </div>
    </div>
  );
}



import { useEffect, useMemo, useState } from "react";

const INITIAL_VISIBLE_ROWS = 12;
const LOAD_MORE_STEP = 12;

export default function MatrixPanel({ title, rows, years, matrixSearch, onMatrixSearch, fmtCompact, fmtCurrency }) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const safeYears = Array.isArray(years) ? years : [];
  const gridTemplateColumns = `minmax(0, 2.5fr) repeat(${safeYears.length}, minmax(0, 0.78fr)) minmax(0, 1.4fr)`;
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_ROWS);

  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE_ROWS);
  }, [matrixSearch, safeRows.length, title]);

  const visibleRows = useMemo(() => safeRows.slice(0, visibleCount), [safeRows, visibleCount]);
  const hasHiddenRows = safeRows.length > visibleRows.length;

  return (
    <section className="bi-panel">
      <div className="bi-panel-header">
        <div>
          <h3>{title}</h3>
          <span>
            {matrixSearch
              ? `${safeRows.length} resultado(s) encontrado(s)`
              : `Mostrando ${visibleRows.length} de ${safeRows.length} categoria(s)`}
          </span>
        </div>
      </div>

      <div className="bi-subfilter-row bi-matrix-toolbar">
        <input
          className="bi-search-input"
          placeholder="Pesquisar na matriz..."
          value={matrixSearch}
          onChange={(e) => onMatrixSearch(e.target.value)}
        />
        <div className="bi-matrix-toolbar-meta">
          <span>{matrixSearch ? "Busca ativa" : `Colunas: ${safeYears.join(" • ")}`}</span>
        </div>
      </div>

      {safeRows.length > 0 ? (
        <>
          <div className="bi-matrix-summary">
            <span>Digite para localizar uma categoria específica sem abrir a lista inteira.</span>
          </div>

          <div className="bi-matrix-scroll">
            <div className="bi-matrix-table">
              <div className="bi-matrix-row bi-matrix-head" style={{ gridTemplateColumns }}>
                <span className="bi-matrix-category-head">Categoria</span>
                {safeYears.map((year) => (
                  <span key={year} className="bi-matrix-year-head">
                    {year}
                  </span>
                ))}
                <span className="bi-matrix-total-head">Total</span>
              </div>
              {visibleRows.map((row) => (
                <div key={row.label} className="bi-matrix-row" style={{ gridTemplateColumns }}>
                  <div className="bi-matrix-category-cell">
                    <strong>{row.label}</strong>
                    <small>Soma do período filtrado</small>
                  </div>
                  {(row.yearValues || []).map((value, index) => (
                    <div key={`${row.label}-${safeYears[index]}`} className="bi-matrix-value-cell">
                      <small>{safeYears[index]}</small>
                      <span>{fmtCompact(value)}</span>
                    </div>
                  ))}
                  <div className="bi-matrix-total-cell">
                    <small>Total</small>
                    <span>{fmtCurrency(row.total)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bi-matrix-actions">
            {hasHiddenRows ? (
              <button
                type="button"
                className="bi-clear-button"
                onClick={() => setVisibleCount((current) => current + LOAD_MORE_STEP)}
              >
                Ver mais {Math.min(LOAD_MORE_STEP, safeRows.length - visibleRows.length)} linha(s)
              </button>
            ) : null}
            {visibleRows.length > INITIAL_VISIBLE_ROWS ? (
              <button
                type="button"
                className="bi-search-button"
                onClick={() => setVisibleCount(INITIAL_VISIBLE_ROWS)}
              >
                Recolher lista
              </button>
            ) : null}
          </div>
        </>
      ) : (
        <div className="empty-state">Sem dados para os filtros selecionados</div>
      )}
    </section>
  );
}

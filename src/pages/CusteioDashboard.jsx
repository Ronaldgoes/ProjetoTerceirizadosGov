import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useCallback } from "react";
import { memo } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { List as VirtualList } from "react-window";
import * as XLSX from "xlsx";
import MatrixPanelView from "../components/MatrixPanel";
import TopBar from "../components/TopBar";
import { CUSTEIO_DATA_CONTRACT } from "../config/custeioDataContract";
import { CUSTEIO_DATA_SOURCE } from "../config/custeioDataSource";
import { useAuth } from "../hooks/useAuth";
import { getPreLiquidacao, groupByUgSubelemento } from "../utils/groupCusteio";
import { loadCusteioSyncPatch, mergeCusteioDataset, saveCusteioSyncPatch } from "../utils/custeioSyncSession";
import { buildMatrixRows as buildMatrixRowsHelper } from "../utils/matrix";
import { searchByText } from "../utils/searchCusteio";
import { matchesSearchQuery, normalizeText } from "../utils/textHelpers";

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
  { key: "creditorConcentration", label: "Concentração" },
  { key: "withoutContract", label: "Sem Contrato" },
  { key: "preLiquidationPayments", label: "Pag. Pré-Liquidação" },
  { key: "itemServices", label: "Itens/Serviços" },
  { key: "itemVariation", label: "Variação Itens" },
  { key: "procurementModes", label: "Modalidades" },
  { key: "contracts", label: "Contratos" },
];

const MONTH_SHORT_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const SEARCH_DEBOUNCE_MS = 300;
const TABLE_INITIAL_LIMIT = 100;
const TABLE_INCREMENT = 100;
const VIRTUAL_ALERT_ROW_HEIGHT = 88;
const VIRTUAL_ALERT_VIEWPORT_HEIGHT = 620;
const VIRTUAL_TABLE_VIEWPORT_HEIGHT = 620;
const VIRTUAL_CONCENTRATION_ROW_HEIGHT = 108;
const VIRTUAL_PRELIQUIDATION_ROW_HEIGHT = 148;
const SYNC_REQUEST_TIMEOUT_MS = 12000;

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

function useDebouncedValue(value, delay = SEARCH_DEBOUNCE_MS) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [delay, value]);

  return debounced;
}

function buildSearchIndex(values) {
  return values.map((item) => normalize(item)).filter(Boolean).join(" ");
}

const LoadMoreControl = memo(function LoadMoreControl({
  visibleCount,
  totalCount,
  onLoadMore,
  increment = TABLE_INCREMENT,
}) {
  if (totalCount <= visibleCount) return null;

  return (
    <div className="bi-load-more">
      <span>{`Exibindo ${visibleCount} de ${totalCount} registros`}</span>
      <button type="button" className="bi-inline-button" onClick={onLoadMore}>
        {`Ver mais ${Math.min(increment, totalCount - visibleCount)}`}
      </button>
    </div>
  );
});

const ProgressiveRows = memo(function ProgressiveRows({
  rows,
  renderRow,
  initialCount = TABLE_INITIAL_LIMIT,
  increment = TABLE_INCREMENT,
}) {
  const [visibleCount, setVisibleCount] = useState(initialCount);

  useEffect(() => {
    setVisibleCount(initialCount);
  }, [initialCount, rows]);

  const visibleRows = useMemo(() => rows.slice(0, visibleCount), [rows, visibleCount]);
  const handleLoadMore = useCallback(() => {
    setVisibleCount((current) => Math.min(rows.length, current + increment));
  }, [increment, rows.length]);

  return (
    <>
      {visibleRows.map(renderRow)}
      <LoadMoreControl
        visibleCount={visibleRows.length}
        totalCount={rows.length}
        onLoadMore={handleLoadMore}
        increment={increment}
      />
    </>
  );
});

const VirtualizedAlertRows = memo(function VirtualizedAlertRows({
  rows,
  renderRow,
  rowHeight = VIRTUAL_ALERT_ROW_HEIGHT,
  viewportHeight = VIRTUAL_ALERT_VIEWPORT_HEIGHT,
  overscan = 6,
  initialCount = TABLE_INITIAL_LIMIT,
  increment = TABLE_INCREMENT,
}) {
  const [visibleCount, setVisibleCount] = useState(initialCount);
  const [scrollTop, setScrollTop] = useState(0);

  useEffect(() => {
    setVisibleCount(initialCount);
    setScrollTop(0);
  }, [initialCount, rows]);

  const scopedRows = useMemo(() => rows.slice(0, visibleCount), [rows, visibleCount]);
  const totalHeight = scopedRows.length * rowHeight;
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const visibleItems = Math.ceil(viewportHeight / rowHeight) + overscan * 2;
  const endIndex = Math.min(scopedRows.length, startIndex + visibleItems);
  const virtualRows = useMemo(
    () => scopedRows.slice(startIndex, endIndex),
    [endIndex, scopedRows, startIndex]
  );

  const handleScroll = useCallback((event) => {
    setScrollTop(event.currentTarget.scrollTop);
  }, []);

  const handleLoadMore = useCallback(() => {
    setVisibleCount((current) => Math.min(rows.length, current + increment));
  }, [increment, rows.length]);

  return (
    <>
      <div className="bi-virtual-scroll" style={{ height: viewportHeight }} onScroll={handleScroll}>
        <div className="bi-virtual-scroll-inner" style={{ height: totalHeight }}>
          {virtualRows.map((row, offset) => {
            const absoluteIndex = startIndex + offset;
            return (
              <div
                key={row.label || row.key || row.id || absoluteIndex}
                className="bi-virtual-row-shell"
                style={{ height: rowHeight, transform: `translateY(${absoluteIndex * rowHeight}px)` }}
              >
                {renderRow(row, absoluteIndex)}
              </div>
            );
          })}
        </div>
      </div>
      <LoadMoreControl
        visibleCount={scopedRows.length}
        totalCount={rows.length}
        onLoadMore={handleLoadMore}
        increment={increment}
      />
    </>
  );
});

const trimSheetName = (name) => String(name || "Dados").replace(/[\\/*?:[\]]/g, " ").slice(0, 31);

const sanitizeFileName = (value) =>
  String(value || "arquivo")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

const buildWorkbookFromSheets = (sheets) => {
  const workbook = XLSX.utils.book_new();
  (sheets || []).forEach((sheet, index) => {
    const rows = Array.isArray(sheet?.rows) ? sheet.rows : [];
    const worksheet = rows.length > 0
      ? XLSX.utils.json_to_sheet(rows)
      : XLSX.utils.aoa_to_sheet([["Sem dados para o recorte selecionado."]]);
    XLSX.utils.book_append_sheet(workbook, worksheet, trimSheetName(sheet?.name || `Aba ${index + 1}`));
  });
  return workbook;
};

const downloadWorkbook = (sheets, fileName) => {
  const workbook = buildWorkbookFromSheets(sheets);
  XLSX.writeFile(workbook, `${sanitizeFileName(fileName)}.xlsx`);
};

const captureElementCanvas = async (element) => {
  if (!element) throw new Error("Bloco não encontrado para exportação.");
  return html2canvas(element, {
    backgroundColor: "#101726",
    scale: Math.max(window.devicePixelRatio || 1, 2),
    useCORS: true,
    logging: false,
    ignoreElements: (node) => node?.dataset?.exportIgnore === "true",
  });
};

const downloadCanvasAsJpg = (canvas, fileName) => {
  const link = document.createElement("a");
  link.download = `${sanitizeFileName(fileName)}.jpg`;
  link.href = canvas.toDataURL("image/jpeg", 0.96);
  link.click();
};

const formatPdfCellValue = (value, key = "") => {
  if (value === null || value === undefined || value === "") return "--";
  if (typeof value === "number") {
    if (Number.isNaN(value)) return "--";
    if (String(key).includes("%") || Math.abs(value) <= 100) return `${value.toFixed(1).replace(".", ",")}${String(key).includes("%") ? "" : ""}`;
    return fmtCurrency(value);
  }
  return String(value);
};

const prettifyExportTitle = (value) =>
  String(value || "Bloco")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const addPdfWrappedText = (pdf, text, x, y, maxWidth, lineHeight = 14) => {
  const lines = pdf.splitTextToSize(String(text || ""), maxWidth);
  pdf.text(lines, x, y);
  return y + lines.length * lineHeight;
};

const ensurePdfSpace = (pdf, currentY, neededHeight, margin, orientation = "portrait") => {
  const pageHeight = pdf.internal.pageSize.getHeight();
  if (currentY + neededHeight <= pageHeight - margin) return currentY;
  pdf.addPage("a4", orientation);
  return margin;
};

const findPrimaryLabelKey = (rows = []) => {
  const sample = rows[0];
  if (!sample) return null;
  return ["Item", "Categoria", "Indicador", "Mês", "Ano", "Chave"].find((key) => key in sample)
    || Object.keys(sample).find((key) => typeof sample[key] === "string")
    || null;
};

const findPrimaryValueKey = (rows = []) => {
  const sample = rows[0];
  if (!sample) return null;
  return ["Valor", "Total", "Diferença", "Variação %", "Impacto %"].find((key) => key in sample)
    || Object.keys(sample).find((key) => typeof sample[key] === "number")
    || null;
};

const buildExportInsights = (sheets = [], metricLabel = "") => {
  const primaryRows = sheets[0]?.rows || [];
  const secondaryRows = sheets[1]?.rows || [];
  const labelKey = findPrimaryLabelKey(primaryRows);
  const valueKey = findPrimaryValueKey(primaryRows);
  const highlights = [];

  if (labelKey && valueKey && primaryRows.length > 0) {
    const numericRows = primaryRows.filter((row) => typeof row[valueKey] === "number" && Number.isFinite(row[valueKey]));
    const sortedRows = [...numericRows].sort((a, b) => (b[valueKey] || 0) - (a[valueKey] || 0));
    const topRow = sortedRows[0];
    const total = numericRows.reduce((acc, row) => acc + (row[valueKey] || 0), 0);
    if (topRow) {
      const concentration = total > 0 ? (topRow[valueKey] / total) * 100 : 0;
      highlights.push({
        title: "Maior destaque",
        value: topRow[labelKey],
        note: `${formatPdfCellValue(topRow[valueKey], valueKey)}${total > 0 ? ` • ${fmtPercent(concentration)}` : ""}`,
      });
    }

    const firstRow = numericRows[0];
    const lastRow = numericRows[numericRows.length - 1];
    if (firstRow && lastRow && firstRow[valueKey]) {
      highlights.push({
        title: "Comparativo do recorte",
        value: fmtPercent(((lastRow[valueKey] - firstRow[valueKey]) / firstRow[valueKey]) * 100),
        note: `${firstRow[labelKey]} -> ${lastRow[labelKey]}`,
      });
    }

    highlights.push({
      title: "Linhas analisadas",
      value: `${primaryRows.length}`,
      note: metricLabel || "Dados do bloco",
    });
  }

  const bullets = [];
  if (highlights[0]) bullets.push(`${highlights[0].value} lidera o bloco analisado, com ${highlights[0].note.toLowerCase()}.`);
  if (highlights[1]) bullets.push(`No período selecionado, o comparativo principal do bloco ficou em ${highlights[1].value}.`);
  if (secondaryRows.length > 0) bullets.push(`A exportação inclui uma segunda leitura de apoio para aprofundar o comparativo do mesmo recorte.`);
  bullets.push("Os números refletem apenas os filtros ativos no momento da exportação.");

  return {
    highlights: highlights.slice(0, 3),
    bullets: bullets.slice(0, 4),
  };
};

const drawPdfHighlights = (pdf, highlights, margin, startY, availableWidth) => {
  if (!highlights.length) return startY;
  const gap = 12;
  const cardWidth = (availableWidth - gap * (highlights.length - 1)) / highlights.length;
  highlights.forEach((item, index) => {
    const x = margin + index * (cardWidth + gap);
    pdf.setFillColor(245, 247, 251);
    pdf.roundedRect(x, startY, cardWidth, 74, 14, 14, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(86, 117, 183);
    pdf.text(item.title, x + 14, startY + 20);
    pdf.setFontSize(15);
    pdf.setTextColor(24, 31, 46);
    pdf.text(String(item.value || "--"), x + 14, startY + 42, { maxWidth: cardWidth - 24 });
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(82, 90, 108);
    pdf.text(String(item.note || ""), x + 14, startY + 60, { maxWidth: cardWidth - 24 });
  });
  return startY + 92;
};

const drawPdfTable = (pdf, rows, startY, margin, availableWidth, options = {}) => {
  const safeRows = Array.isArray(rows) ? rows : [];
  const orientation = options.orientation || "portrait";
  const maxRows = options.maxRows || 8;
  if (safeRows.length === 0) {
    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(10);
    pdf.setTextColor(110, 118, 138);
    pdf.text("Sem dados para o recorte selecionado.", margin, startY);
    return startY + 18;
  }

  const columns = Object.keys(safeRows[0]).slice(0, options.maxCols || 5);
  const columnWidth = availableWidth / Math.max(columns.length, 1);
  let y = startY;

  y = ensurePdfSpace(pdf, y, 28, margin, orientation);
  pdf.setFillColor(86, 117, 183);
  pdf.roundedRect(margin, y, availableWidth, 22, 8, 8, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(255, 255, 255);
  columns.forEach((column, index) => {
    pdf.text(String(column), margin + 8 + index * columnWidth, y + 14, { maxWidth: columnWidth - 12 });
  });
  y += 28;

  safeRows.slice(0, maxRows).forEach((row, rowIndex) => {
    y = ensurePdfSpace(pdf, y, 24, margin, orientation);
    if (rowIndex % 2 === 0) {
      pdf.setFillColor(247, 249, 252);
      pdf.roundedRect(margin, y - 2, availableWidth, 22, 8, 8, "F");
    }
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);
    pdf.setTextColor(52, 58, 74);
    columns.forEach((column, index) => {
      pdf.text(formatPdfCellValue(row[column], column), margin + 8 + index * columnWidth, y + 12, {
        maxWidth: columnWidth - 12,
      });
    });
    y += 24;
  });

  if (safeRows.length > maxRows) {
    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(9);
    pdf.setTextColor(110, 118, 138);
    pdf.text(`Exibindo ${maxRows} de ${safeRows.length} linhas nesta visualização.`, margin, y + 8);
    y += 20;
  }

  return y + 6;
};

const drawPresentationBars = (pdf, rows, x, y, width, height) => {
  const labelKey = findPrimaryLabelKey(rows);
  const valueKey = findPrimaryValueKey(rows);
  const topRows = (rows || [])
    .filter((row) => typeof row[valueKey] === "number" && Number.isFinite(row[valueKey]))
    .sort((a, b) => b[valueKey] - a[valueKey])
    .slice(0, 5);

  pdf.setFillColor(255, 255, 255);
  pdf.roundedRect(x, y, width, height, 18, 18, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.setTextColor(24, 31, 46);
  pdf.text("Leitura visual resumida", x + 18, y + 24);

  if (!labelKey || !valueKey || topRows.length === 0) {
    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(10);
    pdf.setTextColor(110, 118, 138);
    pdf.text("Sem dados numéricos suficientes para montar o resumo visual.", x + 18, y + 48);
    return;
  }

  const maxValue = Math.max(...topRows.map((row) => row[valueKey] || 0), 1);
  topRows.forEach((row, index) => {
    const lineY = y + 54 + index * 34;
    const barWidth = ((row[valueKey] || 0) / maxValue) * (width - 190);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(52, 58, 74);
    pdf.text(String(row[labelKey]), x + 18, lineY, { maxWidth: 150 });
    pdf.setFillColor(226, 232, 240);
    pdf.roundedRect(x + 170, lineY - 8, width - 190, 12, 6, 6, "F");
    pdf.setFillColor(86, 117, 183);
    pdf.roundedRect(x + 170, lineY - 8, Math.max(8, barWidth), 12, 6, 6, "F");
    pdf.setFont("helvetica", "bold");
    pdf.text(formatPdfCellValue(row[valueKey], valueKey), x + width - 90, lineY, { align: "right" });
  });
};

const downloadPresentationPdf = (fileName, options = {}) => {
  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: "a4",
  });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 34;
  const { highlights, bullets } = buildExportInsights(options.sheets || [], options.metricLabel);
  const firstRows = options.sheets?.[0]?.rows || [];

  pdf.setFillColor(12, 22, 45);
  pdf.rect(0, 0, pageWidth, pageHeight, "F");
  pdf.setFillColor(86, 117, 183);
  pdf.roundedRect(margin, margin, pageWidth - margin * 2, 86, 20, 20, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(24);
  pdf.setTextColor(255, 255, 255);
  pdf.text(options.reportTitle || "Modo Apresentação", margin + 24, margin + 34);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(12);
  pdf.text(`Período selecionado: ${options.periodLabel || "--"}`, margin + 24, margin + 58);
  pdf.text(`Métrica analisada: ${options.metricLabel || "--"}`, margin + 24, margin + 76);

  let y = margin + 114;
  y = drawPdfHighlights(pdf, highlights, margin, y, pageWidth - margin * 2);

  pdf.setFillColor(255, 255, 255);
  pdf.roundedRect(margin, y, 330, 168, 18, 18, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(15);
  pdf.setTextColor(24, 31, 46);
  pdf.text("Resumo executivo", margin + 18, y + 26);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);
  let bulletY = y + 52;
  bullets.forEach((bullet) => {
    pdf.setFillColor(216, 49, 62);
    pdf.circle(margin + 22, bulletY - 4, 3, "F");
    pdf.setTextColor(52, 58, 74);
    const lines = pdf.splitTextToSize(bullet, 274);
    pdf.text(lines, margin + 36, bulletY);
    bulletY += lines.length * 14 + 10;
  });

  drawPresentationBars(pdf, firstRows, margin + 348, y, pageWidth - margin * 2 - 348, 168);

  pdf.addPage("a4", "landscape");
  pdf.setFillColor(247, 249, 252);
  pdf.rect(0, 0, pageWidth, pageHeight, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(20);
  pdf.setTextColor(24, 31, 46);
  pdf.text("Dados de apoio para apresentação", margin, margin + 22);
  let slideY = margin + 48;
  (options.sheets || []).slice(0, 2).forEach((sheet, index) => {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.text(`${index + 1}. ${prettifyExportTitle(sheet?.name)}`, margin, slideY);
    slideY = drawPdfTable(pdf, sheet?.rows || [], slideY + 10, margin, pageWidth - margin * 2, {
      orientation: "landscape",
      maxRows: 8,
      maxCols: 6,
    });
    slideY += 10;
  });

  pdf.save(`${sanitizeFileName(fileName)}_apresentacao.pdf`);
};

const downloadStructuredPdf = (fileName, options = {}) => {
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "a4",
  });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 36;
  const usableWidth = pageWidth - margin * 2;
  let y = margin;
  const { highlights, bullets } = buildExportInsights(options.sheets || [], options.metricLabel);

  pdf.setFillColor(16, 23, 38);
  pdf.roundedRect(margin, y, usableWidth, 74, 14, 14, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.setTextColor(255, 255, 255);
  pdf.text(options.reportTitle || "Relatório de Exportação", margin + 18, y + 28);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(214, 221, 232);
  pdf.text(`Período: ${options.periodLabel || "--"}`, margin + 18, y + 48);
  pdf.text(`Métrica: ${options.metricLabel || "--"}`, margin + 18, y + 63);
  y += 98;

  y = drawPdfHighlights(pdf, highlights, margin, y, usableWidth);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.setTextColor(24, 31, 46);
  pdf.text("Leitura do recorte", margin, y);
  y += 18;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(82, 90, 108);
  bullets.forEach((bullet) => {
    pdf.setFillColor(216, 49, 62);
    pdf.circle(margin + 4, y - 4, 2.5, "F");
    y = addPdfWrappedText(pdf, bullet, margin + 14, y, usableWidth - 14, 14) + 6;
  });

  (options.sheets || []).forEach((sheet, index) => {
    y = ensurePdfSpace(pdf, y, 90, margin, "portrait");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.setTextColor(24, 31, 46);
    pdf.text(`${index + 1}. ${prettifyExportTitle(sheet?.name)}`, margin, y);
    y += 8;
    y = drawPdfTable(pdf, sheet?.rows || [], y + 6, margin, usableWidth, {
      orientation: "portrait",
      maxRows: 10,
      maxCols: 5,
    });
    y += 12;
  });
  pdf.save(`${sanitizeFileName(fileName)}.pdf`);
};

function formatValueAndPercentLine(value, percent) {
  const safeValue = Number(value || 0);
  const safePercent = Number(percent || 0);
  const roundedPercent = Number.isFinite(safePercent) ? Number(safePercent.toFixed(1)) : 0;

  if (safeValue === 0 && roundedPercent === 0) return "";
  if (roundedPercent === 0) return fmtCurrency(safeValue);
  if (safeValue === 0) return fmtPercent(safePercent);
  return `${fmtPercent(safePercent)} | ${fmtCurrency(safeValue)}`;
}

function getIpcaReferenceLabel(variation, ipcaValue) {
  if (!Number.isFinite(variation) || !Number.isFinite(ipcaValue)) return null;

  const delta = variation - ipcaValue;
  if (delta <= 0) return "Abaixo do IPCA";
  if (delta <= 2) return "Próximo do IPCA";
  return "Acima do IPCA";
}

const normalize = (value) => normalizeText(value);

function buildUgSubelementoLookupKey(record) {
  return `${String(record?.unidadeGestoraCode || record?.ug || "").trim()}-${String(
    record?.subelementoCode || record?.subelemento || ""
  ).trim()}`;
}

function normalizeProcurementModeValue(value) {
  return normalize(value).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function coalesceDetailedField(record, keys = [], fallback = "") {
  for (const key of keys) {
    const value = record?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }

  return fallback;
}

function parseFlexibleDate(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

  const raw = String(value).trim();
  if (!raw) return null;

  const isoDate = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDate) {
    const [, yearText, monthText, dayText] = isoDate;
    const date = new Date(Number(yearText), Number(monthText) - 1, Number(dayText));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const brDate = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brDate) {
    const [, dayText, monthText, yearText] = brDate;
    const date = new Date(Number(yearText), Number(monthText) - 1, Number(dayText));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const timestamp = Date.parse(raw);
  if (Number.isNaN(timestamp)) return null;
  return new Date(timestamp);
}

function formatDetailedDate(value) {
  const parsed = parseFlexibleDate(value);
  return parsed
    ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(parsed)
    : "--";
}

function getDetailedMetricValue(record, metricKey) {
  if (!record || !metricKey) return 0;
  return Number(record[metricKey] || 0);
}

function getProcurementCategory(record) {
  const rawCategory = normalize(
    coalesceDetailedField(record, ["procurementCategory", "tipoContratacao", "tipoLicitacao"], "")
  );
  if (rawCategory.includes("inexig")) return "Inexigibilidade";
  if (rawCategory.includes("dispensa")) return "Dispensa";

  const dispensationFlag = ["true", "1", "sim"].includes(
    normalize(coalesceDetailedField(record, ["dispensaLicitacao", "isDispensaLicitacao", "dispensa"], ""))
  );
  if (dispensationFlag) return "Dispensa";

  const procurementMode = normalize(
    coalesceDetailedField(record, ["procurementMode", "modalidadeLicitacao", "modalidade"], "")
  );
  if (procurementMode.includes("inexig")) return "Inexigibilidade";
  if (procurementMode.includes("dispensa")) return "Dispensa";
  if (procurementMode) return "Licitação";
  return "";
}

function getIPCAForRow(row, valueKey, ipcaAnnual, ipcaMonthly) {
  if (!row) return null;
  const sourceKey = row?.[valueKey];
  if (!sourceKey) return null;
  if (valueKey === "year") {
    const value = ipcaAnnual?.[String(sourceKey).slice(0, 4)];
    return Number.isFinite(value) ? value : null;
  }
  const value = ipcaMonthly?.[String(sourceKey)];
  return Number.isFinite(value) ? value : null;
}

function extractDetailedRecords(dataset) {
  if (!Array.isArray(dataset?.detailedFacts)) return [];

  return dataset.detailedFacts
    .map((record, index) => {
      if (!record || typeof record !== "object" || Array.isArray(record)) return null;

      const year = Number(coalesceDetailedField(record, ["year", "nuano"], 0));
      const month = Number(coalesceDetailedField(record, ["month", "numes"], 0));
      const periodKey = coalesceDetailedField(
        record,
        ["periodKey", "period", "periodo"],
        year && month ? `${year}-${String(month).padStart(2, "0")}` : ""
      );

      const creditorDocument = String(
        coalesceDetailedField(record, ["creditorDocument", "nucredor", "cpfCnpjCredor", "cpfcnpjcredor"], "")
      ).trim();
      const creditorName = String(
        coalesceDetailedField(record, ["creditorName", "nmcredor", "credorName", "favorecido"], "Não informado")
      ).trim();

      const procurementModeRaw = String(
        coalesceDetailedField(record, ["procurementMode", "modalidadeLicitacao", "modalidade"], "")
      ).trim();
      const isDispensation = ["true", "1", "sim"].includes(
        normalize(coalesceDetailedField(record, ["dispensaLicitacao", "isDispensaLicitacao", "dispensa"], ""))
      );
      const procurementMode = procurementModeRaw || (isDispensation ? "Dispensa de Licitação" : "");
      const procurementCategory = getProcurementCategory(record);
      const contractNumber = String(
        coalesceDetailedField(record, ["contractNumber", "numeroContrato", "nunumerocontrato", "contrato"], "")
      ).trim();
      const nutitulo = String(
        coalesceDetailedField(record, ["nutitulo", "nuTitulo", "titulo"], "")
      ).trim();
      const legalInstrument = String(
        coalesceDetailedField(record, ["legalInstrument", "instrumentoLegal", "instrumento"], "")
      ).trim();
      const sourceOrigin = String(
        coalesceDetailedField(record, ["sourceOrigin", "origemFonte", "origem"], "")
      ).trim();
      const quantity = Number(
        coalesceDetailedField(record, ["quantity", "quantidade", "qtitem", "qtd"], 0)
      ) || 0;
      const unitValue = Number(
        coalesceDetailedField(record, ["unitValue", "valorUnitario", "vlunitario"], 0)
      ) || 0;
      const vlempenhado = Number(coalesceDetailedField(record, ["vlempenhado", "valorEmpenhado"], 0)) || 0;
      const vlliquidado = Number(coalesceDetailedField(record, ["vlliquidado", "valorLiquidado"], 0)) || 0;
      const vlpago = Number(coalesceDetailedField(record, ["vlpago", "valorPago"], 0)) || 0;
      const fallbackValue = Number(
        coalesceDetailedField(record, ["value", "valor", "valorTotal"], 0)
      ) || 0;
      const totalValue =
        Number(coalesceDetailedField(record, ["totalValue", "valorTotalItem", "valorTotal"], 0)) ||
        vlpago ||
        vlliquidado ||
        vlempenhado ||
        fallbackValue;
      const contractStartDate = coalesceDetailedField(
        record,
        ["contractStartDate", "dataInicioVigencia", "dataInicioContrato", "dtinicio"],
        ""
      );
      const contractEndDate = coalesceDetailedField(
        record,
        ["contractEndDate", "dataFimVigencia", "dataFimContrato", "dtfim"],
        ""
      );
      const isFundSupply = ["true", "1", "sim"].includes(
        normalize(coalesceDetailedField(record, ["isFundSupply", "suprimentoFundos", "modalidadeSuprimento"], ""))
      ) || normalize(procurementMode).includes("suprimento");
      const hasContract = Boolean(contractNumber || legalInstrument);
      const unidadeGestoraCode = String(
        coalesceDetailedField(record, ["unidadeGestoraCode", "cdunidadegestora"], "")
      ).trim();
      const unidadeGestoraLabel = String(
        coalesceDetailedField(record, ["unidadeGestoraLabel", "nmunidadegestora", "unidadeGestoraName"], "")
      ).trim();
      const elementoCode = String(coalesceDetailedField(record, ["elementoCode", "cdelemento"], "")).trim();
      const elementoLabel = String(
        coalesceDetailedField(record, ["elementoLabel", "nmelemento", "elementoName"], "")
      ).trim();
      const subelementoCode = String(coalesceDetailedField(record, ["subelementoCode", "cdsubelemento"], "")).trim();
      const subelementoLabel = String(
        coalesceDetailedField(record, ["subelementoLabel", "nmsubelemento", "subelementoName"], "")
      ).trim();
      const classification = String(
        coalesceDetailedField(record, ["classification", "classificacao"], "")
      ).trim();
      const historico = String(
        coalesceDetailedField(record, ["historico", "history"], "")
      ).trim();
      const resumoObjetoContrato = String(
        coalesceDetailedField(record, ["resumoObjetoContrato", "resumoObjeto"], "")
      ).trim();
      const objetoContrato = String(
        coalesceDetailedField(record, ["objetoContrato", "contractObject", "objeto"], "")
      ).trim();
      const contractObject = objetoContrato;
      const description = String(
        coalesceDetailedField(record, ["description", "descricao"], "")
      ).trim();
      const creditorLabel = creditorDocument ? `${creditorDocument} - ${creditorName}` : creditorName;
      const empenhoNumber = String(
        coalesceDetailedField(record, ["empenhoNumber", "nunotaempenho", "numeroEmpenho"], "")
      ).trim();
      const ordemBancariaNumber = String(
        coalesceDetailedField(record, ["ordemBancariaNumber", "nuordembancaria", "numeroOB"], "")
      ).trim();
      const paymentDate = coalesceDetailedField(record, ["paymentDate", "dtdatapagamento", "dataPagamento"], "");
      const liquidationDate = coalesceDetailedField(record, ["liquidationDate", "dtliquidacao", "dataLiquidacao"], "");
      const searchIndex = buildSearchIndex([
        periodKey,
        year,
        month,
        unidadeGestoraCode,
        unidadeGestoraLabel,
        elementoCode,
        elementoLabel,
        subelementoCode,
        subelementoLabel,
        creditorDocument,
        creditorName,
        creditorLabel,
        classification,
        historico,
        resumoObjetoContrato,
        objetoContrato,
        contractObject,
        description,
        procurementMode,
        contractNumber,
        nutitulo,
        legalInstrument,
        empenhoNumber,
        ordemBancariaNumber,
        paymentDate,
        liquidationDate,
        sourceOrigin,
      ]);

      return {
        id: String(coalesceDetailedField(record, ["id"], `detail-${index}`)),
        year: year || null,
        month: month || null,
        periodKey,
        elementoCode,
        elementoLabel,
        subelementoCode,
        subelementoLabel,
        unidadeGestoraCode,
        unidadeGestoraLabel,
        creditorDocument,
        creditorName,
        creditorLabel,
        classification,
        historico,
        resumoObjetoContrato,
        objetoContrato,
        contractObject,
        description,
        procurementMode,
        procurementModeValue: normalizeProcurementModeValue(procurementMode),
        procurementCategory,
        nutitulo,
        sourceOrigin,
        empenhoNumber,
        ordemBancariaNumber,
        paymentDate,
        liquidationDate,
        contractNumber,
        legalInstrument,
        contractStartDate,
        contractEndDate,
        hasContract,
        isFundSupply,
        quantity,
        unitValue,
        value: totalValue,
        totalValue,
        vlempenhado: vlempenhado || totalValue,
        vlliquidado: vlliquidado || 0,
        vlpago: vlpago || 0,
        searchIndex,
      };
    })
    .filter(Boolean);
}

function buildCreditorConcentrationRows(records, filters) {
  return groupByUgSubelemento(records, filters);
}

function buildMissingContractRows(records) {
  return records
    .filter((record) => !record.hasContract && !record.isFundSupply)
    .sort((a, b) => getDetailedMetricValue(b, "vlempenhado") - getDetailedMetricValue(a, "vlempenhado"));
}

function buildItemServiceRows(records, metricKey) {
  const groups = new Map();

  records.forEach((record) => {
    const descriptor =
      record.description ||
      record.contractObject ||
      record.classification ||
      "Item/serviço não identificado";
    const key = [
      descriptor,
      record.unidadeGestoraLabel || "UG não informada",
      record.classification || "--",
      record.contractObject || "--",
    ].join("|");

    const current = groups.get(key) || {
      key,
      description: descriptor,
      classification: record.classification || "--",
      contractObject: record.contractObject || "--",
      unidadeGestoraLabel: record.unidadeGestoraLabel || "UG não informada",
      quantity: 0,
      totalValue: 0,
      unitValues: [],
      quantityRecords: 0,
    };

    const recordQuantity = Number(record.quantity || 0);
    current.quantity += recordQuantity;
    current.totalValue += getDetailedMetricValue(record, metricKey) || record.totalValue || 0;
    if (recordQuantity > 0) current.quantityRecords += 1;
    if (Number(record.unitValue || 0) > 0) current.unitValues.push(Number(record.unitValue));
    groups.set(key, current);
  });

  return [...groups.values()]
    .map((item) => ({
      ...item,
      unitValue:
        item.unitValues.length > 0
          ? item.unitValues.reduce((acc, value) => acc + value, 0) / item.unitValues.length
          : item.quantity > 0
            ? item.totalValue / item.quantity
            : null,
    }))
    .sort((a, b) => b.totalValue - a.totalValue);
}

function buildItemVariationRows(records, metricKey, startPeriodKey, endPeriodKey, ipcaValue) {
  if (!startPeriodKey || !endPeriodKey) return [];

  const groups = new Map();

  records.forEach((record) => {
    if (![startPeriodKey, endPeriodKey].includes(record.periodKey)) return;

    const descriptor =
      record.description ||
      record.contractObject ||
      record.classification ||
      "Item/serviço não identificado";
    const key = [
      descriptor,
      record.unidadeGestoraLabel || "UG não informada",
    ].join("|");
    const current = groups.get(key) || {
      key,
      description: descriptor,
      unidadeGestoraLabel: record.unidadeGestoraLabel || "UG não informada",
      classification: record.classification || "--",
      contractObject: record.contractObject || "--",
      startValue: 0,
      endValue: 0,
    };

    if (record.periodKey === startPeriodKey) current.startValue += getDetailedMetricValue(record, metricKey) || record.totalValue || 0;
    if (record.periodKey === endPeriodKey) current.endValue += getDetailedMetricValue(record, metricKey) || record.totalValue || 0;

    groups.set(key, current);
  });

  return [...groups.values()]
    .map((item) => {
      const meta = getVariationMeta(item.startValue, item.endValue);
      const resolvedIpcaValue = Number.isFinite(ipcaValue) ? ipcaValue : null;
      return {
        ...item,
        variationPercent: meta.percent,
        variationLabel: meta.label,
        ipcaValue: resolvedIpcaValue,
      };
    })
    .filter((item) => item.startValue > 0 || item.endValue > 0)
    .sort((a, b) => {
      if (!Number.isFinite(a.variationPercent)) return -1;
      if (!Number.isFinite(b.variationPercent)) return 1;
      return b.variationPercent - a.variationPercent;
    });
}

function buildProcurementModeRows(records, metricKey) {
  const groups = new Map();

  records.forEach((record) => {
    const category = record.procurementCategory || "Não classificado";
    const mode = record.procurementMode || category;
    const key = `${category}|${mode}`;
    const current = groups.get(key) || {
      key,
      category,
      mode,
      totalValue: 0,
    };
    current.totalValue += getDetailedMetricValue(record, metricKey) || record.totalValue || 0;
    groups.set(key, current);
  });

  return [...groups.values()].sort((a, b) => b.totalValue - a.totalValue);
}

function buildContractRows(records) {
  const today = new Date();
  const sixMonthsFromNow = new Date(today.getFullYear(), today.getMonth() + 6, today.getDate());

  const contracts = new Map();
  records.forEach((record) => {
    if (!record.contractNumber) return;
    const key = `${record.contractNumber}|${record.unidadeGestoraLabel || "--"}`;
    const current = contracts.get(key) || {
      key,
      contractNumber: record.contractNumber,
      unidadeGestoraLabel: record.unidadeGestoraLabel || "UG não informada",
      contractStartDate: record.contractStartDate,
      contractEndDate: record.contractEndDate,
    };
    contracts.set(key, current);
  });

  return [...contracts.values()]
    .map((item) => {
      const endDate = parseFlexibleDate(item.contractEndDate);
      const isActive = Boolean(endDate) && endDate >= today;
      const isExpiringSoon = Boolean(endDate) && endDate >= today && endDate <= sixMonthsFromNow;
      return {
        ...item,
        isActive,
        isExpiringSoon,
      };
    })
    .filter((item) => item.isActive || item.contractStartDate || item.contractEndDate)
    .sort((a, b) => {
      const dateA = parseFlexibleDate(a.contractEndDate)?.getTime() || Number.MAX_SAFE_INTEGER;
      const dateB = parseFlexibleDate(b.contractEndDate)?.getTime() || Number.MAX_SAFE_INTEGER;
      return dateA - dateB;
    });
}

function buildComparisonMetaMap({ records, metricKey, startPeriodKey, endPeriodKey, groupKey, ipcaValue }) {
  if (!startPeriodKey || !endPeriodKey) return new Map();

  const grouped = new Map();
  records.forEach((record) => {
    if (![startPeriodKey, endPeriodKey].includes(record.periodKey)) return;
    const label = record[groupKey] || "Não informado";
    const current = grouped.get(label) || { startValue: 0, endValue: 0 };
    if (record.periodKey === startPeriodKey) current.startValue += record[metricKey];
    if (record.periodKey === endPeriodKey) current.endValue += record[metricKey];
    grouped.set(label, current);
  });

  return new Map(
    [...grouped.entries()].map(([label, values]) => {
      const variation = getVariationMeta(values.startValue, values.endValue);
      return [label, {
        ...values,
        variationPercent: variation.percent,
        variationLabel: variation.label,
        ipcaValue,
      }];
    })
  );
}

function buildPreLiquidationRows(records) {
  return getPreLiquidacao(records);
}

function summarizeDetailedRecords(records) {
  const grouped = new Map();

  (Array.isArray(records) ? records : []).forEach((record) => {
    const year = Number(record?.year);
    const month = Number(record?.month);
    const elementoCode = String(record?.elementoCode || "").trim();
    const subelementoCode = String(record?.subelementoCode || "").trim();
    const unidadeGestoraCode = String(record?.unidadeGestoraCode || "").trim();
    const periodKey = String(record?.periodKey || "").trim();

    if (!Number.isFinite(year) || !Number.isFinite(month) || !periodKey) return;

    const groupKey = `${year}|${month}|${elementoCode}|${subelementoCode}|${unidadeGestoraCode}`;
    const current = grouped.get(groupKey) || {
      year,
      month,
      periodKey,
      monthLabel: periodKey,
      elementoCode,
      elementoLabel: record?.elementoLabel || elementoCode,
      subelementoCode,
      subelementoLabel: record?.subelementoLabel || subelementoCode,
      unidadeGestoraCode,
      unidadeGestoraLabel: record?.unidadeGestoraLabel || unidadeGestoraCode,
      vlempenhado: 0,
      vlliquidado: 0,
      vlpago: 0,
    };

    current.vlempenhado += Number(record?.vlempenhado) || 0;
    current.vlliquidado += Number(record?.vlliquidado) || 0;
    current.vlpago += Number(record?.vlpago) || 0;

    grouped.set(groupKey, current);
  });

  return [...grouped.values()].map((record) => ({
    ...record,
    searchIndex: buildSearchIndex([
      record.year,
      record.month,
      record.periodKey,
      record.elementoCode,
      record.elementoLabel,
      record.subelementoCode,
      record.subelementoLabel,
      record.unidadeGestoraCode,
      record.unidadeGestoraLabel,
    ]),
  }));
}

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
  const visibleItems = (items || []).filter((item) => Number(item?.value || 0) > 0);
  const total = visibleItems.reduce((acc, item) => acc + item.value, 0) || 1;
  let current = 0;
  const colors = ["#5675B7", "#12844C", "#D8313E", "#666666", "#7E90C7", "#3C9C63", "#E8848D", "#B7C6E5"];

  const segments = visibleItems.map((item, index) => {
    const start = current;
    const pct = (item.value / total) * 100;
    if (pct === 0) return null;
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
  }).filter(Boolean);

  return {
    segments,
    background: segments.length ? `conic-gradient(${segments.map((segment) => segment.range).join(", ")})` : "none",
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
        .filter((item) => item.pct !== 0)
        .sort((a, b) => b.value - a.value);

      return [sourceLabel, { total, items }];
    })
  );
}

function buildVariationRowsForExport({
  rows,
  valueKey = "year",
  showIPCA = false,
  ipcaAnnual = IPCA_ANUAL_FALLBACK,
  ipcaMonthly = IPCA_MENSAL_FALLBACK,
}) {
  return rows.map((current, index) => {
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

    return {
      ...current,
      variation,
      ipcaValue,
      dissonance,
    };
  });
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M12 3v10m0 0 4-4m-4 4-4-4M5 17v1a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="m6 9 6 6 6-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ExportMenu({ label = "Exportar", onSelectFormat, busy = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleOutsideClick = (event) => {
      if (menuRef.current?.contains(event.target)) return;
      setIsOpen(false);
    };

    document.addEventListener("pointerdown", handleOutsideClick);
    return () => document.removeEventListener("pointerdown", handleOutsideClick);
  }, [isOpen]);

  const handleSelect = async (format) => {
    setIsOpen(false);
    await onSelectFormat?.(format);
  };

  return (
    <div ref={menuRef} className="bi-export-menu" data-export-ignore="true">
      <button
        type="button"
        className="bi-export-trigger"
        onClick={() => setIsOpen((current) => !current)}
        disabled={busy}
        aria-label={busy ? "Exportando" : label}
        title={busy ? "Exportando" : label}
      >
        {busy ? (
          <span className="bi-export-trigger-text">Exportando...</span>
        ) : (
          <>
            <DownloadIcon />
            <span className="bi-export-trigger-label">{label}</span>
            <ChevronDownIcon />
          </>
        )}
      </button>
      {isOpen ? (
        <div className="bi-export-options">
          <button type="button" onClick={() => handleSelect("pdf")}>PDF</button>
          <button type="button" onClick={() => handleSelect("slides")}>Apresentação</button>
          <button type="button" onClick={() => handleSelect("jpg")}>JPG</button>
          <button type="button" onClick={() => handleSelect("xlsx")}>Excel</button>
        </div>
      ) : null}
    </div>
  );
}

function ExportableBlock({
  title,
  targetRef,
  sheets,
  onExport,
  busy = false,
  buttonLabel = "Exportar",
  variant = "panel",
  children,
}) {
  if (variant === "section") {
    return (
      <div className={`bi-export-scope bi-export-scope--${variant}`}>
        <div ref={targetRef}>{children}</div>
      </div>
    );
  }

  return (
    <div className={`bi-export-scope bi-export-scope--${variant}`}>
      <div ref={targetRef} className="bi-export-frame">
        {children}
        <div className="bi-export-toolbar" data-export-ignore="true">
          <ExportMenu
            label={buttonLabel}
            busy={busy}
            onSelectFormat={(format) => onExport?.({ title, format, targetRef, sheets })}
          />
        </div>
      </div>
    </div>
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

function BarList({
  title,
  items,
  onClickItem,
  selectedItem,
  limitHeight = false,
  referenceTotal = null,
  relatedLabels = null,
  comparisonMetaMap = null,
}) {
  const safeItems = Array.isArray(items) ? items : [];
  const maxValue = safeItems[0]?.value || 1;
  const hasCrossSelection = !selectedItem && relatedLabels && relatedLabels.size > 0;
  const effectiveReferenceTotal = Number.isFinite(referenceTotal) && referenceTotal > 0
    ? referenceTotal
    : safeItems.reduce((acc, item) => acc + item.value, 0);

  if (safeItems.length === 0) {
    return (
      <section className="bi-panel">
        <div className="bi-panel-header">
          <h3>{title}</h3>
        </div>
        <div className="empty-state">Sem dados para os filtros selecionados</div>
      </section>
    );
  }

  return (
    <section className="bi-panel">
      <div className="bi-panel-header">
        <h3>{title}</h3>
      </div>

      <div className={`bi-bar-list${limitHeight ? " is-scrollable" : ""}`}>
        {safeItems.map((item) => {
          const isSelected = selectedItem === item.label;
          const isRelated = relatedLabels?.has(item.label);
          const isDimmed = hasCrossSelection && !isRelated;
          const itemPct = effectiveReferenceTotal > 0 ? (item.value / effectiveReferenceTotal) * 100 : 0;
          const comparisonMeta = comparisonMetaMap?.get(item.label);

          return (
            <div
              key={item.label}
              className={`bi-bar-item${isSelected ? " is-selected" : ""}${isRelated ? " is-related" : ""}${
                isDimmed ? " is-dimmed" : ""
              }${onClickItem ? " is-clickable" : ""}`}
              onClick={() => onClickItem?.(item.label === selectedItem ? null : item.label)}
            >
              <div className="bi-bar-copy">
                <strong>{item.label}</strong>
                <div className="bi-bar-meta">
                  {formatValueAndPercentLine(item.value, itemPct) ? (
                    <div className="bi-bar-metrics">
                      {item.value !== 0 ? <span>{fmtCurrency(item.value)}</span> : null}
                      {itemPct !== 0 ? <small>{fmtPercent(itemPct)}</small> : null}
                    </div>
                  ) : null}
                  {comparisonMeta ? (
                    <div className="bi-bar-comparison">
                      <small className={comparisonMeta.variationPercent >= 0 ? "positive" : "negative"}>
                        {comparisonMeta.variationLabel}
                      </small>
                      {getIpcaReferenceLabel(comparisonMeta.variationPercent, comparisonMeta.ipcaValue) ? (
                        <small className="bi-table-subtext">
                          {getIpcaReferenceLabel(comparisonMeta.variationPercent, comparisonMeta.ipcaValue)}
                        </small>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="bi-bar-track">
                <div className="bi-bar-fill" style={{ width: `${(item.value / maxValue) * 100}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TopRankingPanel({ title, items, limit = 10 }) {
  const safeItems = Array.isArray(items) ? items : [];
  const displayedItems = safeItems.slice(0, limit);
  const totalItems = safeItems.totalGroups ?? safeItems.length;

  if (displayedItems.length === 0) {
    return (
      <section className="bi-panel">
        <div className="bi-panel-header">
          <h3>{title}</h3>
        </div>
        <div className="empty-state">Sem dados para os filtros selecionados</div>
      </section>
    );
  }

  return (
    <section className="bi-panel">
      <div className="bi-panel-header">
        <h3>{title}</h3>
      </div>

      <div className="bi-ranking-list ranking-scroll">
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

function PiePanel({ title, items, panelKey, hoveredState, onHoverChange, relationInfo, relationTargetLabel }) {
  const safeItems = Array.isArray(items) ? items : [];
  const safeHoverState = hoveredState && typeof hoveredState === "object" ? hoveredState : null;
  const hoveredLabel = safeHoverState?.source === panelKey ? safeHoverState.label : null;
  const relatedLabels =
    safeHoverState?.source && safeHoverState.source !== panelKey
      ? new Set(relationInfo?.items?.map((item) => item.label) || [])
      : null;
  const selectedLabels = hoveredLabel ? new Set([hoveredLabel]) : relatedLabels;
  const { segments, background, activeSegment, highlightedSegments } = buildPieSegments(
    safeItems,
    selectedLabels,
    hoveredLabel
  );
  const hasCrossSelection = !hoveredLabel && highlightedSegments.length > 0;
  const visibleItemCount = segments.length;

  if (segments.length === 0) {
    return (
      <section className="bi-panel">
        <div className="bi-panel-header">
          <h3>{title}</h3>
        </div>
        <div className="empty-state">Sem dados para os filtros selecionados</div>
      </section>
    );
  }

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
                <strong>{visibleItemCount}</strong>
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
                  {formatValueAndPercentLine(segment.value, segment.pct) ? (
                    <span className="bi-pie-meta">
                      {formatValueAndPercentLine(segment.value, segment.pct)}
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function DistributionRelationshipCard({ hoveredState, relationInfo, relationTargetLabel, othersItems = [], onClear }) {
  const visibleOtherItems = othersItems.filter((item) => Number(item?.value || 0) > 0);
  const visibleRelationItems = (relationInfo?.items || []).filter((item) => Number(item?.pct || 0) !== 0);

  if (hoveredState?.label === "Outras Despesas" && visibleOtherItems.length > 0) {
    return (
      <section className="bi-panel bi-distribution-relationship-panel">
        <div className="bi-pie-relationship-card">
          <strong>Composição de Outras Despesas</strong>
          <div className="bi-pie-relationship-list">
            {visibleOtherItems.map((item) => (
              <div key={`distribution-others-${item.label}`} className="bi-pie-relationship-item">
                <span>{item.label}</span>
                {item.value !== 0 ? <span>{fmtCurrency(item.value)}</span> : null}
              </div>
            ))}
          </div>
          <button type="button" className="bi-pie-clear-selection" onClick={onClear}>
            Limpar seleção
          </button>
        </div>
      </section>
    );
  }

  if (hoveredState && relationInfo && visibleRelationItems.length > 0) {
    return (
      <section className="bi-panel bi-distribution-relationship-panel">
        <div className="bi-pie-relationship-card">
          <strong>
            {hoveredState.label}
            {" -> "}
            {relationTargetLabel}
          </strong>
          <div className="bi-pie-relationship-list">
            {visibleRelationItems.map((item) => (
              <div key={`${hoveredState.label}-${item.label}`} className="bi-pie-relationship-item">
                <span>{item.label}</span>
                {formatValueAndPercentLine(item.value, item.pct) ? (
                  <span>{formatValueAndPercentLine(item.value, item.pct)}</span>
                ) : null}
              </div>
            ))}
          </div>
          <button type="button" className="bi-pie-clear-selection" onClick={onClear}>
            Limpar seleção
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="bi-panel bi-distribution-relationship-panel">
      <div className="bi-pie-relationship-card is-empty">
        Clique em um item para ver a relação entre subelemento e unidade gestora.
      </div>
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
  dominantLabel = "UG dominante",
  monitoredLabel = "UGs monitoradas",
  detailLabel = "subelementos",
  emptyDetailMessage = "Sem itens para o recorte selecionado.",
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
  const referencePeriodLabel = activePeriodLabel || overview.focusPeriod?.fullLabel || "--";
  const previousReferenceLabel = isMonthlySeries ? "mês anterior" : "ano anterior";
  const dominantPeriodLabel = activePeriodLabel
    ? `${dominantLabel} em ${activePeriodLabel}`
    : `${dominantLabel} no último período`;
  const totalPeriodLabel = activePeriodLabel
    ? `Total das Top 10 em ${activePeriodLabel}`
    : "Total das Top 10 no último período";

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
  const detailItems = detailSubelements
    .slice(0, 10)
    .map((item) => {
      const pct = overview.focusTotal > 0 ? (item.value / overview.focusTotal) * 100 : 0;
      return {
        ...item,
        pct,
      };
    })
    .filter((item) => Number(item.pct.toFixed(1)) !== 0);

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
              <strong>{activePeriodLabel ? `${dominantLabel} em ${activePeriodLabel}` : `${dominantLabel} no último período`}</strong>
            </div>
            <div className="bi-evolution-kpi">
              <span>{dominantPeriodLabel}</span>
              <strong>{overview.leader?.label || "--"}</strong>
            </div>
            <div className="bi-evolution-kpi">
              <span>{totalPeriodLabel}</span>
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
                  <span>{tooltipData.subtitle ? `${dominantLabel} em ${tooltipData.subtitle}` : tooltipData.subtitle}</span>
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
                <strong>{monitoredLabel}</strong>
                <span>{activePeriod ? `Ranking em ${activePeriodLabel}` : "Último período disponível"}</span>
              </div>

              <div className="bi-linechart-legend">
                {overview.rankedSeries.map((line, index) => {
                  const deltaLabel = Number.isNaN(line.delta)
                    ? `Sem base em relação ao ${previousReferenceLabel}`
                    : `${line.delta >= 0 ? "+" : ""}${line.delta.toFixed(1)}% em relação ao ${previousReferenceLabel}`;
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
                          <span>{`No período selecionado: ${fmtCurrency(line.focusValue)}`}</span>
                          <span>{deltaLabel}</span>
                          <span>Pico: {fmtCurrency(line.peakPoint?.value || 0)} em {peakPeriodLabel}</span>
                        </div>
                    </button>
                  );
                })}
              </div>
              <div ref={detailPanelRef} className="bi-evolution-detail-panel">
                <div className="bi-evolution-detail-header">
                  <strong>{selectedSeries?.label || `Selecione ${dominantLabel.toLowerCase().replace(" dominante", "")}`}</strong>
                  <span>{`Top 10 ${detailLabel} em ${detailPeriodLabel}`}</span>
                </div>
                <div className="bi-evolution-detail-list">
                  {detailItems.length > 0 ? (
                    detailItems.map((item, index) => (
                      <div key={`${selectedSeries?.label || "ug"}-${item.label}`} className="bi-evolution-detail-item">
                        <span className="bi-evolution-detail-rank">{String(index + 1).padStart(2, "0")}</span>
                        <div className="bi-evolution-detail-copy">
                          <strong>{item.label}</strong>
                          <span>{formatValueAndPercentLine(item.value, item.pct)}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="bi-evolution-detail-empty">{emptyDetailMessage}</div>
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
  const safeItems = Array.isArray(items) ? items : [];
  const maxValue = Math.max(...safeItems.map((item) => item.value), 1);

  if (safeItems.length === 0) {
    return (
      <section className="bi-panel">
        <div className="bi-panel-header">
          <h3>Série Anual</h3>
          <span>{metricLabel}</span>
        </div>
        <div className="empty-state">Sem dados para os filtros selecionados</div>
      </section>
    );
  }

  return (
    <section className="bi-panel">
      <div className="bi-panel-header">
        <h3>Série Anual</h3>
        <span>{metricLabel}</span>
      </div>

      <div className="bi-annual-chart">
        {safeItems.map((item) => (
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
  const safeItems = Array.isArray(items) ? items : [];
  const maxValue = Math.max(...safeItems.map((item) => item.value), 1);

  if (safeItems.length === 0) {
    return (
      <section className="bi-panel">
        <div className="bi-panel-header">
          <h3>{title}</h3>
          <span>{metricLabel}</span>
        </div>
        <div className="empty-state">Sem dados para os filtros selecionados</div>
      </section>
    );
  }

  return (
    <section className="bi-panel">
      <div className="bi-panel-header">
        <h3>{title}</h3>
        <span>{metricLabel}</span>
      </div>

      <div className="bi-annual-chart">
        {safeItems.map((item) => (
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
  ipcaEstimated = false,
}) {
  const [sortBy, setSortBy] = useState("period");
  const getDissonanceEmoji = (color) => {
    if (color === "positive") return "😊";
    if (color === "warning") return "😐";
    if (color === "negative") return "😢";
    return "";
  };

  const safeRows = Array.isArray(rows) ? rows : [];
  const withVariation = buildVariationRowsForExport({
    rows: safeRows,
    valueKey,
    showIPCA,
    ipcaAnnual,
    ipcaMonthly,
  }).map((row) => {
    let dissonanceColor = "";
    if (row.dissonance !== null) {
      if (row.dissonance <= 0) dissonanceColor = "positive";
      else if (row.dissonance <= 2) dissonanceColor = "warning";
      else dissonanceColor = "negative";
    }

    return { ...row, dissonanceColor };
  });
  const sortedRows = useMemo(() => {
    const items = [...withVariation];
    if (sortBy === "value") return items.sort((a, b) => b.value - a.value);
    if (sortBy === "variation") {
      return items.sort((a, b) => {
        if (!Number.isFinite(a.variation)) return 1;
        if (!Number.isFinite(b.variation)) return -1;
        return b.variation - a.variation;
      });
    }
    return items;
  }, [sortBy, withVariation]);
  const formatRowLabel = (row) => (valueKey === "period" ? formatPeriodLabel(row[valueKey]) : row[valueKey]);

  if (sortedRows.length === 0) {
    return (
      <section className="bi-panel">
        <div className="bi-panel-header">
          <div>
            <h3>{title}</h3>
            {showIPCA && ipcaEstimated ? <span className="bi-inline-badge warning">IPCA estimado</span> : null}
          </div>
        </div>
        <div className="empty-state">Sem dados para os filtros selecionados</div>
      </section>
    );
  }

  return (
    <section className="bi-panel">
      <div className="bi-panel-header">
        <div>
          <h3>{title}</h3>
          {showIPCA && ipcaEstimated ? <span className="bi-inline-badge warning">IPCA estimado</span> : null}
        </div>
        <div className="bi-table-controls">
          <label htmlFor={`${title}-sort`}>Ordenar por</label>
          <select id={`${title}-sort`} value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="period">{periodLabel}</option>
            <option value="value">Valor final</option>
            <option value="variation">Variação percentual</option>
          </select>
        </div>
      </div>

      <div className={`bi-table${showIPCA ? " has-ipca" : ""}`}>
        <div className="bi-table-row bi-table-head">
          <span>{periodLabel}</span>
          <span>Total</span>
          <span>Variação</span>
          {showIPCA && <span>IPCA</span>}
          {showIPCA && <span>Dissonância</span>}
          {showIPCA && <span>Comparação</span>}
        </div>
        {sortedRows.map((row) => {
          const tooltipLabel = [
            `Empenhado: ${fmtCurrency(row.vlempenhado || row.value || 0)}`,
            `Liquidado: ${fmtCurrency(row.vlliquidado || 0)}`,
            `Pago: ${fmtCurrency(row.vlpago || 0)}`,
          ].join("\n");

          return (
          <div key={row[valueKey]} className="bi-table-row">
            <span>{formatRowLabel(row)}</span>
            <span title={tooltipLabel}>{fmtCurrency(row.value)}</span>
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
            {showIPCA && (
              <span className="bi-table-subtext">
                {Number.isFinite(row.ipcaValue) ? getIpcaReferenceLabel(row.variation, row.ipcaValue) : null}
              </span>
            )}
          </div>
        )})}
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
  const safeCards = Array.isArray(cards) ? cards.filter(Boolean) : [];

  if (safeCards.length === 0) {
    return (
      <section className="bi-panel">
        <div className="bi-panel-header">
          <h3>{title}</h3>
        </div>
        <div className="empty-state">Sem dados para os filtros selecionados</div>
      </section>
    );
  }

  return (
    <section className="bi-panel">
      <div className="bi-panel-header">
        <h3>{title}</h3>
      </div>

      <div className="bi-insights">
        {safeCards.map((card) => (
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
  const safeOptions = Array.isArray(options) ? options : [];
  const safeSelectedValues = Array.isArray(selectedValues) ? selectedValues : [];
  const [isOpen, setIsOpen] = useState(false);
  const deferredSearchValue = useDeferredValue(searchValue);
  const filteredOptions = useMemo(
    () => safeOptions.filter((option) => normalize(option.label).includes(normalize(deferredSearchValue))),
    [deferredSearchValue, safeOptions]
  );
  const selectedLabels = useMemo(
    () => safeOptions.filter((option) => safeSelectedValues.includes(option.value)).map((option) => option.label),
    [safeOptions, safeSelectedValues]
  );

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
              {safeSelectedValues.length > 0 ? `${safeSelectedValues.length} selecionado(s)` : "Nenhum selecionado"}
              {safeSelectedValues.length > 0 ? (
                <button type="button" className="bi-inline-clear" onClick={onClear}>
                  Limpar
                </button>
              ) : null}
            </div>
            <div className="bi-checkbox-list">
              {filteredOptions.map((option) => {
                const checked = safeSelectedValues.includes(option.value);
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

const AlertTableRow = memo(function AlertTableRow({ row, totalValue = 0 }) {
  const compareVal = row.endValue ?? row.currentValue;
  const impact = totalValue > 0 ? (compareVal / totalValue) * 100 : 0;
  const isCritical = row.variationPercent > 50 || !Number.isFinite(row.variationPercent);
  const isHigh = row.variationPercent > 25;

  return (
    <div className={`bi-alert-row${row.exceededThreshold ? " is-alert" : ""}${isCritical ? " is-critical" : ""}`}>
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
});

const AlertTable = memo(function AlertTable({ title, rows, baseLabel, compareLabel, emptyMessage, totalValue = 0 }) {
  const alertsCount = rows.filter((r) => r.exceededThreshold).length;
  const avgVariation = rows.length > 0
    ? rows.reduce((acc, r) => acc + (Number.isFinite(r.variationPercent) ? r.variationPercent : 0), 0) / rows.length
    : 0;
  const renderAlertRow = useCallback(
    (row) => (
      <AlertTableRow
        key={row.label}
        row={row}
        totalValue={totalValue}
      />
    ),
    [totalValue]
  );

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
          <VirtualizedAlertRows rows={rows} renderRow={renderAlertRow} />
        </div>
      ) : (
        <div className="empty-state">{emptyMessage}</div>
      )}
    </section>
  );
});

function DetailedDataStatus({ title, hasDetailedData, emptyMessage }) {
  return (
    <section className="bi-panel">
      <div className="bi-panel-header">
        <h3>{title}</h3>
        <span>{hasDetailedData ? "Base detalhada aplicada" : "Aguardando base detalhada do portal"}</span>
      </div>

      <div className="bi-narrative">
        {hasDetailedData ? (
          <p>{emptyMessage}</p>
        ) : (
          <>
            <p>
              A base atual do painel continua agregada por ano, mês, elemento, subelemento e UG. Para esta trilha,
              o portal precisa expor também campos detalhados como credor, datas de liquidação/pagamento,
              classificação, objeto do contrato e modalidade de licitação.
            </p>
            <p>
              A interface desta aba já está preparada para consumir essa base assim que ela passar a ser publicada em
              `dataset.detailedFacts`.
            </p>
          </>
        )}
      </div>
    </section>
  );
}

const VirtualTableRows = memo(function VirtualTableRows({
  rows,
  rowComponent,
  rowHeight,
  viewportHeight = VIRTUAL_TABLE_VIEWPORT_HEIGHT,
}) {
  if (!rows.length) return null;

  return (
    <div className="bi-virtual-list-shell">
      <VirtualList
        className="bi-react-window-list"
        defaultHeight={viewportHeight}
        overscanCount={6}
        rowComponent={rowComponent}
        rowCount={rows.length}
        rowHeight={rowHeight}
        rowProps={{ rows }}
        style={{ height: viewportHeight }}
      />
    </div>
  );
});

const ConcentrationTableRow = memo(function ConcentrationTableRow({ index, rows, style }) {
  const row = rows[index];
  if (!row) return null;

  return (
    <div style={style} className="bi-virtual-list-item">
      <div key={row.key} className="bi-alert-row bi-alert-row-concentration">
        <div className="bi-alert-category">
          <strong>{row.ugDescricao}</strong>
          <span className="bi-alert-impact">{row.subelementoDescricao}</span>
        </div>
        <span>{row.ug || "--"}</span>
        <span>{row.subelemento || "--"}</span>
        <span>{fmtCurrency(row.empenhado)}</span>
        <span>{fmtCurrency(row.liquidado)}</span>
        <span>{fmtCurrency(row.pago)}</span>
      </div>
    </div>
  );
});

const PreLiquidationTableRow = memo(function PreLiquidationTableRow({ index, rows, style }) {
  const row = rows[index];
  if (!row) return null;

  return (
    <div style={style} className="bi-virtual-list-item">
      <div key={row.id} className="bi-alert-row bi-alert-row-preliquidation is-alert">
        <div className="bi-alert-category">
          <span className="bi-alert-badge warning">Atenção</span>
          <strong>{row.unidadeGestoraLabel || "UG não informada"}</strong>
          <span className="bi-alert-impact">{row.subelementoLabel || "Subelemento não informado"}</span>
        </div>
        <span className="bi-cell-stack">
          <small>Empenho: {row.empenhoNumber || "--"}</small>
          <small>OB: {row.ordemBancariaNumber || "--"}</small>
        </span>
        <span className="bi-preliquidation-creditor">{row.creditorLabel || "Não informado"}</span>
        <span className="bi-cell-stack">
          <small className="bi-cell-label">Pagamento</small>
          <strong>{formatDetailedDate(row.paymentDate)}</strong>
        </span>
        <span className="bi-cell-stack">
          <small className="bi-cell-label">Liquidação</small>
          <strong>{formatDetailedDate(row.liquidationDate)}</strong>
        </span>
        <span className="bi-cell-stack">
          <small className="bi-cell-label">Valor Pago</small>
          <strong>{fmtCurrency(row.vlpago || row.value)}</strong>
        </span>
      </div>
    </div>
  );
});

const CreditorConcentrationTable = memo(function CreditorConcentrationTable({ rows }) {
  if (rows.length === 0) {
    return (
      <section className="bi-panel">
        <div className="bi-panel-header">
          <h3>Concentração por UG e subelemento</h3>
          <span>Sem dados para os filtros selecionados</span>
        </div>
        <div className="empty-state">Sem dados para os filtros selecionados</div>
      </section>
    );
  }

  return (
    <section className="bi-panel">
      <div className="bi-panel-header">
        <div>
          <h3>Concentração por UG e subelemento</h3>
          <div className="bi-alert-summary-mini">
            <span>{rows.length} combinações únicas analisadas</span>
            <span>•</span>
            <span>Valores consolidados no período ativo</span>
          </div>
        </div>
      </div>

      <div className="bi-alert-table">
        <div className="bi-alert-row bi-alert-head bi-alert-row-concentration">
          <span>UG / Subelemento</span>
          <span>UG</span>
          <span>Subelemento</span>
          <span>Empenhado</span>
          <span>Liquidado</span>
          <span>Pago</span>
        </div>
        <VirtualTableRows
          rows={rows}
          rowComponent={ConcentrationTableRow}
          rowHeight={VIRTUAL_CONCENTRATION_ROW_HEIGHT}
        />
      </div>
    </section>
  );
});

const PreLiquidationPaymentTable = memo(function PreLiquidationPaymentTable({ rows, hasDetailedData }) {
  if (!hasDetailedData) {
    return (
      <DetailedDataStatus
        title="Pagamentos Antes da Liquidação"
        hasDetailedData={hasDetailedData}
        emptyMessage="Nenhum pagamento fora da ordem esperada foi encontrado para o recorte selecionado."
      />
    );
  }

  if (rows.length === 0) {
    return (
      <section className="bi-panel">
        <div className="bi-panel-header">
          <h3>Pagamentos com liquidação posterior ou ausente</h3>
          <span>Sem dados para os filtros selecionados</span>
        </div>
        <div className="empty-state">Sem dados para os filtros selecionados</div>
      </section>
    );
  }

  return (
    <section className="bi-panel">
      <div className="bi-panel-header">
        <div>
          <h3>Pagamentos com liquidação posterior ou ausente</h3>
          <div className="bi-alert-summary-mini">
            <span>{rows.length} registros localizados</span>
            <span>•</span>
            <span>Ordenado por valor pago</span>
          </div>
        </div>
      </div>

      <div className="bi-alert-table">
        <div className="bi-alert-row bi-alert-head bi-alert-row-preliquidation">
          <span>UG / Subelemento</span>
          <span>Empenho / OB</span>
          <span>Credor</span>
          <span>Pagamento</span>
          <span>Liquidação</span>
          <span>Valor Pago</span>
        </div>
        <VirtualTableRows
          rows={rows}
          rowComponent={PreLiquidationTableRow}
          rowHeight={VIRTUAL_PRELIQUIDATION_ROW_HEIGHT}
        />
      </div>
    </section>
  );
});

function MissingContractTable({ rows, hasDetailedData }) {
  if (!hasDetailedData || rows.length === 0) {
    return (
      <DetailedDataStatus
        title="Despesas sem Contrato"
        hasDetailedData={hasDetailedData}
        emptyMessage="Nenhuma despesa sem contrato foi encontrada para o recorte selecionado."
      />
    );
  }

  return (
    <section className="bi-panel">
      <div className="bi-panel-header">
        <h3>Despesas sem contrato ou instrumento legal</h3>
        <span>Suprimento de fundos excluído</span>
      </div>
      <div className="bi-alert-table">
        <div className="bi-alert-row bi-alert-head bi-alert-row-contractless">
          <span>UG / Subelemento</span>
          <span>Empenhado</span>
          <span>Liquidado</span>
          <span>Pago</span>
        </div>
        <ProgressiveRows
          rows={rows}
          initialCount={30}
          renderRow={(row) => (
            <div key={row.id} className="bi-alert-row bi-alert-row-contractless is-alert">
              <div className="bi-alert-category">
                <span className="bi-alert-badge warning">Sem contrato</span>
                <strong>{row.unidadeGestoraLabel || "UG não informada"}</strong>
                <span className="bi-alert-impact">{row.subelementoLabel || "Subelemento não informado"}</span>
              </div>
              <span>{fmtCurrency(row.vlempenhado)}</span>
              <span>{fmtCurrency(row.vlliquidado)}</span>
              <span>{fmtCurrency(row.vlpago)}</span>
            </div>
          )}
        />
      </div>
    </section>
  );
}

function ItemServiceTable({ rows, hasDetailedData, metricLabel }) {
  if (!hasDetailedData || rows.length === 0) {
    return (
      <DetailedDataStatus
        title="Despesas por Item/Serviço"
        hasDetailedData={hasDetailedData}
        emptyMessage="Dados não disponíveis para esta análise."
      />
    );
  }

  return (
    <section className="bi-panel">
      <div className="bi-panel-header">
        <h3>Itens e serviços adquiridos</h3>
        <span>{metricLabel}</span>
      </div>
      <div className="bi-alert-table">
        <div className="bi-alert-row bi-alert-head bi-alert-row-item">
          <span>Descrição</span>
          <span>Quantidade</span>
          <span>Valor Unitário</span>
          <span>Valor Total</span>
          <span>UG</span>
        </div>
        <div className="ranking-scroll">
          <ProgressiveRows
            rows={rows}
            initialCount={30}
            renderRow={(row) => (
              <div key={row.key} className="bi-alert-row bi-alert-row-item">
                <div className="bi-alert-category">
                  <strong>{row.description}</strong>
                  <span className="bi-alert-impact">{row.classification}</span>
                  {row.contractObject && row.contractObject !== "--" ? <span className="bi-alert-impact">{row.contractObject}</span> : null}
                </div>
                <span>{row.quantity > 0 ? new Intl.NumberFormat("pt-BR").format(row.quantity) : "--"}</span>
                <span>{Number(row.unitValue) > 0 ? fmtCurrency(row.unitValue) : "--"}</span>
                <span>{fmtCurrency(row.totalValue)}</span>
                <span>{row.unidadeGestoraLabel}</span>
              </div>
            )}
          />
        </div>
      </div>
    </section>
  );
}

function ItemVariationTable({ rows, hasDetailedData, startPeriodKey, endPeriodKey }) {
  if (!hasDetailedData || rows.length === 0) {
    return (
      <DetailedDataStatus
        title="Variação por Item/Serviço"
        hasDetailedData={hasDetailedData}
        emptyMessage="Dados não disponíveis para esta análise."
      />
    );
  }

  return (
    <section className="bi-panel">
      <div className="bi-panel-header">
        <div>
          <h3>Variação por item/serviço</h3>
          <div className="bi-alert-summary-mini">
            <span>{startPeriodKey || "--"} → {endPeriodKey || "--"}</span>
          </div>
        </div>
      </div>
      <div className="bi-alert-table">
        <div className="bi-alert-row bi-alert-head bi-alert-row-item-variation">
          <span>Descrição</span>
          <span>Valor Inicial</span>
          <span>Valor Final</span>
          <span>Variação</span>
          <span>IPCA</span>
          <span>Comparação</span>
        </div>
        <ProgressiveRows
          rows={rows}
          initialCount={30}
          renderRow={(row) => (
            <div key={row.key} className="bi-alert-row bi-alert-row-item-variation">
              <div className="bi-alert-category">
                <strong>{row.description}</strong>
                <span className="bi-alert-impact">{row.unidadeGestoraLabel}</span>
              </div>
              <span>{fmtCurrency(row.startValue)}</span>
              <span>{fmtCurrency(row.endValue)}</span>
              <span className={row.variationPercent >= 0 ? "positive" : "negative"}>{row.variationLabel}</span>
              <span>{Number.isFinite(row.ipcaValue) ? `${row.ipcaValue.toFixed(2)}%` : "--"}</span>
              <span>{Number.isFinite(row.ipcaValue) ? getIpcaReferenceLabel(row.variationPercent, row.ipcaValue) : null}</span>
            </div>
          )}
        />
      </div>
    </section>
  );
}

function ProcurementModeTable({ rows, hasDetailedData }) {
  if (!hasDetailedData || rows.length === 0) {
    return (
      <DetailedDataStatus
        title="Despesas por Modalidade"
        hasDetailedData={hasDetailedData}
        emptyMessage="Dados não disponíveis para esta análise."
      />
    );
  }

  return (
    <section className="bi-panel">
      <div className="bi-panel-header">
        <h3>Despesas por modalidade</h3>
      </div>
      <div className="bi-alert-table">
        <div className="bi-alert-row bi-alert-head bi-alert-row-mode">
          <span>Categoria</span>
          <span>Modalidade</span>
          <span>Total</span>
        </div>
        <ProgressiveRows
          rows={rows}
          renderRow={(row) => (
            <div key={row.key} className="bi-alert-row bi-alert-row-mode">
              <span>{row.category}</span>
              <span>{row.mode}</span>
              <span>{fmtCurrency(row.totalValue)}</span>
            </div>
          )}
        />
      </div>
    </section>
  );
}

function ContractsTable({ rows, hasDetailedData }) {
  if (!hasDetailedData || rows.length === 0) {
    return (
      <DetailedDataStatus
        title="Contratos e Vigências"
        hasDetailedData={hasDetailedData}
        emptyMessage="Dados não disponíveis para esta análise."
      />
    );
  }

  return (
    <section className="bi-panel">
      <div className="bi-panel-header">
        <h3>Contratos vigentes</h3>
        <span>Destaque para vigências inferiores a 6 meses</span>
      </div>
      <div className="bi-alert-table">
        <div className="bi-alert-row bi-alert-head bi-alert-row-contracts">
          <span>Contrato</span>
          <span>UG</span>
          <span>Início</span>
          <span>Fim</span>
        </div>
        <ProgressiveRows
          rows={rows}
          initialCount={30}
          renderRow={(row) => (
            <div key={row.key} className={`bi-alert-row bi-alert-row-contracts${row.isExpiringSoon ? " is-alert" : ""}`}>
              <div className="bi-alert-category">
                {row.isExpiringSoon ? <span className="bi-alert-badge warning">Vencendo</span> : null}
                <strong>{row.contractNumber}</strong>
              </div>
              <span>{row.unidadeGestoraLabel}</span>
              <span>{formatDetailedDate(row.contractStartDate)}</span>
              <span>{formatDetailedDate(row.contractEndDate)}</span>
            </div>
          )}
        />
      </div>
    </section>
  );
}

export default function CusteioDashboard() {
  const { user } = useAuth();
  const distributionSectionRef = useRef(null);
  const rankingSectionRef = useRef(null);
  const overviewMainSectionExportRef = useRef(null);
  const overviewRankingSectionExportRef = useRef(null);
  const overviewInsightsSectionExportRef = useRef(null);
  const overviewAnnualExportRef = useRef(null);
  const overviewVariationExportRef = useRef(null);
  const overviewTopUgExportRef = useRef(null);
  const overviewTopSubExportRef = useRef(null);
  const overviewSummaryExportRef = useRef(null);
  const overviewInsightsExportRef = useRef(null);
  const monthlyMainSectionExportRef = useRef(null);
  const monthlySummarySectionExportRef = useRef(null);
  const monthlyVariationSectionExportRef = useRef(null);
  const monthlySeriesExportRef = useRef(null);
  const monthlyVariationExportRef = useRef(null);
  const monthlySummaryExportRef = useRef(null);
  const monthlyHighlightsMonthExportRef = useRef(null);
  const monthlyHighlightsVariationExportRef = useRef(null);
  const distributionGridExportRef = useRef(null);
  const distributionRelationsExportRef = useRef(null);
  const distributionSubExportRef = useRef(null);
  const distributionUgExportRef = useRef(null);
  const distributionRelationCardExportRef = useRef(null);
  const trendsSectionExportRef = useRef(null);
  const trendsSubExportRef = useRef(null);
  const trendsUgExportRef = useRef(null);
  const matrixSectionExportRef = useRef(null);
  const matrixSubExportRef = useRef(null);
  const matrixUgExportRef = useRef(null);
  const evolutionSectionExportRef = useRef(null);
  const evolutionPanelExportRef = useRef(null);
  const evolutionSubPanelExportRef = useRef(null);
  const alertsTopSectionExportRef = useRef(null);
  const alertsTablesSectionExportRef = useRef(null);
  const alertsConfigExportRef = useRef(null);
  const alertsInsightsExportRef = useRef(null);
  const alertsPeriodExportRef = useRef(null);
  const alertsHistoricalExportRef = useRef(null);
  const creditorConcentrationExportRef = useRef(null);
  const withoutContractExportRef = useRef(null);
  const preLiquidationExportRef = useRef(null);
  const itemServicesExportRef = useRef(null);
  const itemVariationExportRef = useRef(null);
  const procurementModesExportRef = useRef(null);
  const contractsExportRef = useRef(null);
  const fixedPeriodStartInput = "01/01/2021";
  const currentDateInput = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
  const [dataset, setDataset] = useState(null);
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [lastRefreshAttemptAt, setLastRefreshAttemptAt] = useState(null);
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
  const [selectedEvolutionSubelement, setSelectedEvolutionSubelement] = useState(null);
  const [evolutionType, setEvolutionType] = useState("monthly");
  const [evolutionView, setEvolutionView] = useState("ug");
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
  const [procurementModeSearch, setProcurementModeSearch] = useState("");
  const [selectedProcurementModes, setSelectedProcurementModes] = useState([]);
  const [exportingKey, setExportingKey] = useState(null);
  const deferredMatrixSearch = useDeferredValue(matrixSearch);

  useEffect(() => {
    if (activeTab !== "distribution" || !distributionHover) return undefined;

    const handleOutsideClick = (event) => {
      if (distributionSectionRef.current?.contains(event.target)) return;
      setDistributionHover(null);
    };

    document.addEventListener("pointerdown", handleOutsideClick);
    return () => document.removeEventListener("pointerdown", handleOutsideClick);
  }, [activeTab, distributionHover]);

  useEffect(() => {
    if (activeTab !== "trends") return undefined;
    if (!selectedSubelementInRanking && !selectedUgInRanking) return undefined;

    const handleOutsideClick = (event) => {
      if (rankingSectionRef.current?.contains(event.target)) return;
      setSelectedSubelementInRanking(null);
      setSelectedUgInRanking(null);
    };

    document.addEventListener("pointerdown", handleOutsideClick);
    return () => document.removeEventListener("pointerdown", handleOutsideClick);
  }, [activeTab, selectedSubelementInRanking, selectedUgInRanking]);

  useEffect(() => {
    if (activeTab !== "ugRanking") return undefined;
    if (!selectedRankingPeriod && !selectedEvolutionUg && !selectedEvolutionSubelement) return undefined;

    const handleOutsideClick = (event) => {
      if (evolutionSectionExportRef.current?.contains(event.target)) return;
      setSelectedRankingPeriod(null);
      setSelectedEvolutionUg(null);
      setSelectedEvolutionSubelement(null);
    };

    document.addEventListener("pointerdown", handleOutsideClick);
    return () => document.removeEventListener("pointerdown", handleOutsideClick);
  }, [activeTab, selectedEvolutionSubelement, selectedEvolutionUg, selectedRankingPeriod]);

  const refreshDashboard = useCallback(async () => {
    try {
      setLastRefreshAttemptAt(new Date());
      setIsRefreshing(true);
      setRefreshInfo("");
      setStatus("Carregando base oficial publicada...");

      const storedPatch = loadCusteioSyncPatch();
      const cacheResponse = await fetch(`${CUSTEIO_DATA_SOURCE.cache.aggregatedJson}?t=${Date.now()}`);
      if (!cacheResponse.ok) {
        throw new Error(`Falha ao carregar ${CUSTEIO_DATA_SOURCE.cache.aggregatedJson}: ${cacheResponse.status}`);
      }

      const officialCache = await cacheResponse.json();
      const initialDataset = storedPatch ? mergeCusteioDataset(officialCache, storedPatch) : officialCache;

      setDataset(initialDataset);
      setLastSyncAt(storedPatch?.syncedAt ? new Date(storedPatch.syncedAt) : null);
      setStatus("Sincronizando base oficial do portal...");

      let syncCompleted = false;
      let syncPatch = null;

      try {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), SYNC_REQUEST_TIMEOUT_MS);
        let syncResponse;
        try {
          syncResponse = await fetch("/api/sync-custeio", {
            method: "POST",
            signal: controller.signal,
          });
        } finally {
          window.clearTimeout(timeoutId);
        }

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

      const resolvedPatch = syncPatch || storedPatch;
      const mergedDataset = resolvedPatch ? mergeCusteioDataset(officialCache, resolvedPatch) : officialCache;

      setDataset(mergedDataset);
      setLastSyncAt(resolvedPatch?.syncedAt ? new Date(resolvedPatch.syncedAt) : null);
      setStatus("");
      setRefreshInfo(
        syncPatch
          ? "Base atualizada no login com os dados mais recentes do portal."
          : syncCompleted
            ? "Base oficial sincronizada automaticamente com o Portal da Transparência."
            : "Painel carregado com a base oficial publicada disponível."
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

  const lastAttemptLabel = useMemo(() => {
    if (!lastRefreshAttemptAt) return null;

    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(lastRefreshAttemptAt);
  }, [lastRefreshAttemptAt]);

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

    const datasetFacts = Array.isArray(dataset?.facts) ? dataset.facts : [];
    const datasetElementos = Array.isArray(dataset?.elementos) ? dataset.elementos : [];
    const datasetSubelementos = Array.isArray(dataset?.subelementos) ? dataset.subelementos : [];
    const datasetUnidades = Array.isArray(dataset?.unidades) ? dataset.unidades : [];

    const relevantFacts = datasetFacts.filter(([, , , subelementoCode]) =>
      String(subelementoCode || "").startsWith(CUSTEIO_SUBELEMENTO_PREFIX)
    );
    const relevantElementCodes = new Set(relevantFacts.map(([, , elementoCode]) => String(elementoCode)));
    const relevantSubelementCodes = new Set(relevantFacts.map(([, , , subelementoCode]) => String(subelementoCode)));
    const relevantUnidadeCodes = new Set(relevantFacts.map(([, , , , unidadeCode]) => String(unidadeCode)));

    return {
      elementos: new Map(
        datasetElementos
          .filter((item) => relevantElementCodes.has(String(item.code)))
          .map((item) => [item.code, item])
      ),
      subelementos: new Map(
        datasetSubelementos
          .filter((item) => relevantSubelementCodes.has(String(item.code)))
          .map((item) => [item.code, item])
      ),
      unidades: new Map(
        datasetUnidades
          .filter((item) => relevantUnidadeCodes.has(String(item.code)))
          .map((item) => [item.code, item])
      ),
    };
  }, [dataset]);

  const records = useMemo(() => {
    if (!dataset) return [];
    const datasetFacts = Array.isArray(dataset?.facts) ? dataset.facts : [];

    return datasetFacts
      .filter(([, , , subelementoCode]) => String(subelementoCode || "").startsWith(CUSTEIO_SUBELEMENTO_PREFIX))
      .map(([year, month, elementoCode, subelementoCode, unidadeCode, vlempenhado, vlliquidado, vlpago]) => {
        const elemento = dimensionLookup.elementos.get(elementoCode);
        const subelemento = dimensionLookup.subelementos.get(subelementoCode);
        const unidade = dimensionLookup.unidades.get(unidadeCode);
        const periodKey = `${year}-${String(month).padStart(2, "0")}`;
        const elementoLabel = elemento?.label || elementoCode;
        const subelementoLabel = subelemento?.label || subelementoCode;
        const unidadeGestoraLabel = unidade?.label || unidadeCode;

        return {
          year,
          month,
          periodKey,
          monthLabel: dataset.periodLabels?.[periodKey] || periodKey,
          elementoCode,
          elementoLabel,
          subelementoCode,
          subelementoLabel,
          unidadeGestoraCode: unidadeCode,
          unidadeGestoraLabel,
          vlempenhado,
          vlliquidado,
          vlpago,
          searchIndex: buildSearchIndex([
            year,
            month,
            periodKey,
            elementoCode,
            elementoLabel,
            subelementoCode,
            subelementoLabel,
            unidadeCode,
            unidadeGestoraLabel,
          ]),
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

  const effectiveAlertStartPeriod = useMemo(
    () => (selectedPeriodStart === "all" ? null : selectedPeriodStart),
    [selectedPeriodStart]
  );

  const effectiveAlertEndPeriod = useMemo(
    () => (selectedPeriodEnd === "all" ? null : selectedPeriodEnd),
    [selectedPeriodEnd]
  );

  const dimensionOptions = useMemo(() => {
    if (!dataset) return { elementos: [], subelementos: [], unidades: [] };

    return {
      elementos: createOptions([...dimensionLookup.elementos.values()]),
      subelementos: createOptions([...dimensionLookup.subelementos.values()]),
      unidades: createOptions([...dimensionLookup.unidades.values()]),
    };
  }, [dataset, dimensionLookup]);

  const detailedRecords = useMemo(() => extractDetailedRecords(dataset), [dataset]);

  const procurementModeOptions = useMemo(() => {
    const datasetOptions = Array.isArray(dataset?.procurementModeOptions)
      ? dataset.procurementModeOptions
          .map((item) => {
            if (typeof item === "string") {
              return {
                value: normalizeProcurementModeValue(item),
                label: item,
              };
            }

            const label = String(item?.label || item?.name || item?.value || "").trim();
            if (!label) return null;

            return {
              value: normalizeProcurementModeValue(item?.value || label),
              label,
            };
          })
          .filter(Boolean)
      : [];

    if (datasetOptions.length > 0) return datasetOptions;

    const recordOptions = [...new Set(detailedRecords.map((record) => record.procurementMode).filter(Boolean))]
      .map((label) => ({
        value: normalizeProcurementModeValue(label),
        label,
      }));

    return recordOptions.length > 0 ? recordOptions : [];
  }, [dataset, detailedRecords]);

  const activeFilters = useMemo(
    () => ({
      selectedYear,
      periodStart: selectedPeriodStart,
      periodEnd: selectedPeriodEnd,
      selectedElementos,
      selectedSubelementos,
      selectedUnidades,
      selectedProcurementModes,
    }),
    [
      selectedElementos,
      selectedPeriodEnd,
      selectedPeriodStart,
      selectedProcurementModes,
      selectedSubelementos,
      selectedUnidades,
      selectedYear,
    ]
  );

  const textSearchMatches = useMemo(
    () => searchByText(detailedRecords, appliedSearch),
    [appliedSearch, detailedRecords]
  );

  const textSearchMatchKeys = useMemo(
    () => new Set(textSearchMatches.map((item) => item.key)),
    [textSearchMatches]
  );

  const textSearchMatchedUgCodes = useMemo(
    () => new Set(textSearchMatches.map((item) => String(item.ug || "").trim()).filter(Boolean)),
    [textSearchMatches]
  );

  const filteredDetailedRecords = useMemo(() => {
    if (!detailedRecords.length) return [];
    const searchText = normalize(appliedSearch);

    return detailedRecords.filter((record) => {
      const yearOk = activeFilters.selectedYear === "all" || record.year === Number(activeFilters.selectedYear);
      const elementoOk =
        activeFilters.selectedElementos.length === 0 || activeFilters.selectedElementos.includes(record.elementoCode);
      const subelementoOk =
        activeFilters.selectedSubelementos.length === 0
        || activeFilters.selectedSubelementos.includes(record.subelementoCode);
      const unidadeOk =
        activeFilters.selectedUnidades.length === 0 || activeFilters.selectedUnidades.includes(record.unidadeGestoraCode);
      const procurementOk =
        activeFilters.selectedProcurementModes.length === 0
        || activeFilters.selectedProcurementModes.includes(record.procurementModeValue);
      const periodStartOk =
        activeFilters.periodStart === "all" || !record.periodKey || record.periodKey >= activeFilters.periodStart;
      const periodEndOk =
        activeFilters.periodEnd === "all" || !record.periodKey || record.periodKey <= activeFilters.periodEnd;
      const searchOk = !searchText || matchesSearchQuery(record.searchIndex, searchText);

      return yearOk && elementoOk && subelementoOk && unidadeOk && procurementOk && periodStartOk && periodEndOk && searchOk;
    });
  }, [activeFilters, appliedSearch, detailedRecords]);

  const procurementHistoryScopedRecords = useMemo(() => {
    if (!detailedRecords.length) return [];
    const searchText = normalize(appliedSearch);

    return detailedRecords.filter((record) => {
      const yearOk = selectedYear === "all" || record.year === Number(selectedYear);
      const elementoOk = selectedElementos.length === 0 || selectedElementos.includes(record.elementoCode);
      const subelementoOk =
        selectedSubelementos.length === 0 || selectedSubelementos.includes(record.subelementoCode);
      const unidadeOk = selectedUnidades.length === 0 || selectedUnidades.includes(record.unidadeGestoraCode);
      const procurementOk =
        selectedProcurementModes.length === 0
        || selectedProcurementModes.includes(record.procurementModeValue);
      const searchOk =
        !searchText
        || matchesSearchQuery(record.searchIndex, searchText)
        || textSearchMatchKeys.has(buildUgSubelementoLookupKey(record))
        || textSearchMatchedUgCodes.has(String(record.unidadeGestoraCode || "").trim());

      return yearOk && elementoOk && subelementoOk && unidadeOk && procurementOk && searchOk;
    });
  }, [
    appliedSearch,
    detailedRecords,
    selectedElementos,
    selectedProcurementModes,
    selectedSubelementos,
    selectedUnidades,
    selectedYear,
    textSearchMatchKeys,
    textSearchMatchedUgCodes,
  ]);

  const recordsForVisibleTabs = useMemo(
    () => (selectedProcurementModes.length > 0 ? summarizeDetailedRecords(filteredDetailedRecords) : records),
    [filteredDetailedRecords, records, selectedProcurementModes.length]
  );

  const recordsForHistoryTabs = useMemo(
    () => (
      selectedProcurementModes.length > 0
        ? summarizeDetailedRecords(procurementHistoryScopedRecords)
        : records
    ),
    [procurementHistoryScopedRecords, records, selectedProcurementModes.length]
  );

  const historyScopedRecords = useMemo(() => {
    if (!recordsForHistoryTabs.length) return [];
    const searchText = normalize(appliedSearch);

    return recordsForHistoryTabs.filter((record) => {
      const yearOk = selectedYear === "all" || record.year === Number(selectedYear);
      const elementoOk = selectedElementos.length === 0 || selectedElementos.includes(record.elementoCode);
      const subelementoOk = selectedSubelementos.length === 0 || selectedSubelementos.includes(record.subelementoCode);
      const unidadeOk = selectedUnidades.length === 0 || selectedUnidades.includes(record.unidadeGestoraCode);
      const searchOk =
        !searchText
        || matchesSearchQuery(record.searchIndex, searchText)
        || textSearchMatchKeys.has(buildUgSubelementoLookupKey(record))
        || textSearchMatchedUgCodes.has(String(record.unidadeGestoraCode || "").trim());

      return yearOk && elementoOk && subelementoOk && unidadeOk && searchOk;
    });
  }, [
    appliedSearch,
    recordsForHistoryTabs,
    selectedElementos,
    selectedSubelementos,
    selectedUnidades,
    selectedYear,
    textSearchMatchKeys,
    textSearchMatchedUgCodes,
  ]);

  const visibleRecords = useMemo(() => {
    if (!recordsForVisibleTabs.length) return [];
    const searchText = normalize(appliedSearch);

    return recordsForVisibleTabs.filter((record) => {
      const yearOk = selectedYear === "all" || record.year === Number(selectedYear);
      const elementoOk = selectedElementos.length === 0 || selectedElementos.includes(record.elementoCode);
      const subelementoOk =
        selectedSubelementos.length === 0 || selectedSubelementos.includes(record.subelementoCode);
      const unidadeOk = selectedUnidades.length === 0 || selectedUnidades.includes(record.unidadeGestoraCode);
      const periodStartOk = selectedPeriodStart === "all" || record.periodKey >= selectedPeriodStart;
      const periodEndOk = selectedPeriodEnd === "all" || record.periodKey <= selectedPeriodEnd;
      const searchOk =
        !searchText
        || matchesSearchQuery(record.searchIndex, searchText)
        || textSearchMatchKeys.has(buildUgSubelementoLookupKey(record))
        || textSearchMatchedUgCodes.has(String(record.unidadeGestoraCode || "").trim());

      return yearOk && elementoOk && subelementoOk && unidadeOk && periodStartOk && periodEndOk && searchOk;
    });
  }, [
    appliedSearch,
    recordsForVisibleTabs,
    selectedElementos,
    selectedPeriodEnd,
    selectedPeriodStart,
    selectedSubelementos,
    selectedUnidades,
    selectedYear,
    textSearchMatchKeys,
    textSearchMatchedUgCodes,
  ]);

  const preLiquidationDetailLookup = useMemo(() => {
    const lookup = new Map();

    filteredDetailedRecords.forEach((record) => {
      const keys = [record.nutitulo, record.contractNumber]
        .map((value) => String(value || "").trim())
        .filter(Boolean);

      if (keys.length === 0) return;

      keys.forEach((key) => {
        const current = lookup.get(key) || {
          subelementoCode: "",
          subelementoLabel: "",
          liquidationDate: "",
          empenhoNumber: "",
          sourceOrigin: "",
        };

        const sourceOrigin = normalize(record.sourceOrigin);
        const nextSubelementoCode =
          current.subelementoCode
          || (sourceOrigin.includes("empenho") ? record.subelementoCode : "")
          || record.subelementoCode
          || "";
        const nextSubelementoLabel =
          current.subelementoLabel
          || (sourceOrigin.includes("empenho") ? record.subelementoLabel : "")
          || record.subelementoLabel
          || "";
        const nextLiquidationDate =
          current.liquidationDate
          || (sourceOrigin.includes("liquidacao") ? record.liquidationDate : "")
          || record.liquidationDate
          || "";
        const nextEmpenhoNumber =
          current.empenhoNumber
          || (sourceOrigin.includes("empenho") ? record.empenhoNumber : "")
          || record.empenhoNumber
          || "";

        lookup.set(key, {
          subelementoCode: nextSubelementoCode,
          subelementoLabel: nextSubelementoLabel,
          liquidationDate: nextLiquidationDate,
          empenhoNumber: nextEmpenhoNumber,
          sourceOrigin: current.sourceOrigin || record.sourceOrigin || "",
        });
      });
    });

    return lookup;
  }, [filteredDetailedRecords]);

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

  const ipcaAnnualEstimated = useMemo(
    () => !(dataset?.ipcaAnnual && Object.keys(dataset.ipcaAnnual).length > 0),
    [dataset]
  );

  const ipcaMonthlyEstimated = useMemo(
    () => !(dataset?.ipcaMonthly && Object.keys(dataset.ipcaMonthly).length > 0),
    [dataset]
  );

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
          vlempenhado: yearRecords.reduce((acc, record) => acc + record.vlempenhado, 0),
          vlliquidado: yearRecords.reduce((acc, record) => acc + record.vlliquidado, 0),
          vlpago: yearRecords.reduce((acc, record) => acc + record.vlpago, 0),
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

  const concentrationSourceRecords = useMemo(
    () => (visibleRecords.length > 0 ? visibleRecords : filteredDetailedRecords),
    [filteredDetailedRecords, visibleRecords]
  );

  const creditorConcentrationRows = useMemo(
    () =>
      activeTab === "creditorConcentration"
        ? buildCreditorConcentrationRows(concentrationSourceRecords, activeFilters)
        : [],
    [activeFilters, activeTab, concentrationSourceRecords]
  );

  const missingContractRows = useMemo(
    () => (activeTab === "withoutContract" ? buildMissingContractRows(filteredDetailedRecords) : []),
    [activeTab, filteredDetailedRecords]
  );

  const preLiquidationPaymentRows = useMemo(
    () => (
      activeTab === "preLiquidationPayments"
        ? buildPreLiquidationRows(filteredDetailedRecords).map((row) => {
            const fallback =
              preLiquidationDetailLookup.get(String(row.nutitulo || "").trim())
              || preLiquidationDetailLookup.get(String(row.contractNumber || "").trim());
            return {
              ...row,
              subelementoCode: row.subelementoCode || fallback?.subelementoCode || "",
              subelementoLabel:
                row.subelementoLabel
                || fallback?.subelementoLabel
                || (selectedSubelementos.length === 1
                  ? dimensionLookup.subelementos.get(selectedSubelementos[0])?.label
                  : "")
                || "Subelemento não informado",
              liquidationDate: row.liquidationDate || fallback?.liquidationDate || "",
              empenhoNumber: row.empenhoNumber || fallback?.empenhoNumber || "",
            };
          })
        : []
    ),
    [activeTab, dimensionLookup.subelementos, filteredDetailedRecords, preLiquidationDetailLookup, selectedSubelementos]
  );

  const itemServiceRows = useMemo(
    () => (activeTab === "itemServices" ? buildItemServiceRows(filteredDetailedRecords, selectedMetric) : []),
    [activeTab, filteredDetailedRecords, selectedMetric]
  );

  const procurementModeRows = useMemo(
    () => (activeTab === "procurementModes" ? buildProcurementModeRows(filteredDetailedRecords, selectedMetric) : []),
    [activeTab, filteredDetailedRecords, selectedMetric]
  );

  const contractRows = useMemo(() => {
    if (activeTab !== "contracts") return [];
    const startDate = parseFlexibleDate(selectedPeriodStartInput);
    const endDate = parseFlexibleDate(selectedPeriodEndInput);

    return buildContractRows(filteredDetailedRecords).filter((row) => {
      const contractEnd = parseFlexibleDate(row.contractEndDate);
      if (!contractEnd) return true;
      if (startDate && contractEnd < startDate) return false;
      if (endDate && contractEnd > endDate) return false;
      return true;
    });
  }, [activeTab, filteredDetailedRecords, selectedPeriodEndInput, selectedPeriodStartInput]);

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

  const distributionSelectionDetails = useMemo(() => {
    if (!distributionHover) {
      return {
        relationInfo: null,
        relationTargetLabel: "",
        othersItems: [],
      };
    }

    if (distributionHover.label === "Outras Despesas") {
      return {
        relationInfo: null,
        relationTargetLabel: "",
        othersItems: distributionHover.source === "subelemento" ? fullSubelementos.slice(10) : fullUnidades.slice(10),
      };
    }

    if (distributionHover.source === "subelemento") {
      return {
        relationInfo: distributionRelations.bySubelemento.get(distributionHover.label) || null,
        relationTargetLabel: "UGs relacionadas",
        othersItems: [],
      };
    }

    return {
      relationInfo: distributionRelations.byUnidade.get(distributionHover.label) || null,
      relationTargetLabel: "Subelementos relacionados",
      othersItems: [],
    };
  }, [distributionHover, distributionRelations.bySubelemento, distributionRelations.byUnidade, fullSubelementos, fullUnidades]);

  const rankingSubelementos = useMemo(() => {
    if (activeTab !== "trends") return [];
    return aggregateBy(visibleRecords, "subelementoLabel", selectedMetric, 5000);
  }, [activeTab, selectedMetric, visibleRecords]);

  const rankingUnidades = useMemo(() => {
    if (activeTab !== "trends") return [];
    return aggregateBy(visibleRecords, "unidadeGestoraLabel", selectedMetric, 5000);
  }, [activeTab, selectedMetric, visibleRecords]);

  const rankingRelations = useMemo(() => {
    if (activeTab !== "trends") {
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

  const rankingTotalDespesa = useMemo(
    () => visibleRecords.reduce((acc, record) => acc + (record[selectedMetric] || 0), 0),
    [selectedMetric, visibleRecords]
  );

  const rankingSubelementoRelatedLabels = useMemo(() => {
    if (!selectedUgInRanking) return null;
    return new Set(
      (rankingRelations.byUnidade.get(selectedUgInRanking)?.items || []).map((item) => item.label)
    );
  }, [rankingRelations.byUnidade, selectedUgInRanking]);

  const rankingUgRelatedLabels = useMemo(() => {
    if (!selectedSubelementInRanking) return null;
    return new Set(
      (rankingRelations.bySubelemento.get(selectedSubelementInRanking)?.items || []).map((item) => item.label)
    );
  }, [rankingRelations.bySubelemento, selectedSubelementInRanking]);

  const rankingSubelementosReferenceTotal = useMemo(() => {
    if (selectedUgInRanking) {
      return rankingRelations.byUnidade.get(selectedUgInRanking)?.total || 0;
    }
    return rankingTotalDespesa;
  }, [rankingRelations.byUnidade, rankingTotalDespesa, selectedUgInRanking]);

  const rankingUnidadesReferenceTotal = useMemo(() => {
    if (selectedSubelementInRanking) {
      return rankingRelations.bySubelemento.get(selectedSubelementInRanking)?.total || 0;
    }
    return rankingTotalDespesa;
  }, [rankingRelations.bySubelemento, rankingTotalDespesa, selectedSubelementInRanking]);

  const activeVariationIPCA = useMemo(
    () => getIPCAForRow({ period: effectiveAlertEndPeriod }, "period", ipcaAnnual, ipcaMonthly) ?? 0,
    [effectiveAlertEndPeriod, ipcaAnnual, ipcaMonthly]
  );

  const rankingSubelementVariationMap = useMemo(
    () =>
      activeTab === "trends"
        ? buildComparisonMetaMap({
            records: visibleRecords,
            metricKey: selectedMetric,
            startPeriodKey: effectiveAlertStartPeriod,
            endPeriodKey: effectiveAlertEndPeriod,
            groupKey: "subelementoLabel",
            ipcaValue: activeVariationIPCA,
          })
        : new Map(),
    [activeTab, activeVariationIPCA, effectiveAlertEndPeriod, effectiveAlertStartPeriod, selectedMetric, visibleRecords]
  );

  const rankingUgVariationMap = useMemo(
    () =>
      activeTab === "trends"
        ? buildComparisonMetaMap({
            records: visibleRecords,
            metricKey: selectedMetric,
            startPeriodKey: effectiveAlertStartPeriod,
            endPeriodKey: effectiveAlertEndPeriod,
            groupKey: "unidadeGestoraLabel",
            ipcaValue: activeVariationIPCA,
          })
        : new Map(),
    [activeTab, activeVariationIPCA, effectiveAlertEndPeriod, effectiveAlertStartPeriod, selectedMetric, visibleRecords]
  );

  const monthlyVisibleTotals = useMemo(() => {
    if (!["monthly", "trends", "ugRanking"].includes(activeTab)) return [];

    const grouped = new Map();

    visibleRecords.forEach((record) => {
      const current = grouped.get(record.periodKey) || {
        periodKey: record.periodKey,
        label: `${record.periodKey} - ${record.monthLabel}`,
        value: 0,
        vlempenhado: 0,
        vlliquidado: 0,
        vlpago: 0,
      };

      current.value += record[selectedMetric];
      current.vlempenhado += record.vlempenhado;
      current.vlliquidado += record.vlliquidado;
      current.vlpago += record.vlpago;
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

  const topSubelementTrendSeries = useMemo(() => {
    if (activeTab !== "ugRanking") {
      return { periods: [], series: [] };
    }

    if (topSubelementos.length === 0) {
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
      if (!topSubelementos.slice(0, ugQuantity).some((item) => item.label === record.subelementoLabel)) {
        return;
      }

      const periodKey = evolutionType === "monthly" ? record.periodKey : String(record.year);
      const mapKey = `${record.subelementoLabel}::${periodKey}`;
      periodValueMap.set(mapKey, (periodValueMap.get(mapKey) || 0) + record[selectedMetric]);
    });

    const series = topSubelementos.slice(0, ugQuantity).map((subelemento, index) => {
      const points = periods.map((period) => ({
        periodKey: period.periodKey,
        value: periodValueMap.get(`${subelemento.label}::${period.periodKey}`) || 0,
      }));

      const subelementoRecords = visibleRecords.filter((r) => r.subelementoLabel === subelemento.label);
      const topSubelementsOverall = aggregateBy(subelementoRecords, "unidadeGestoraLabel", selectedMetric, 10);
      const topSubelementsByPeriod = new Map(
        periods.map((period) => {
          const scopedRecords = subelementoRecords.filter((record) =>
            evolutionType === "monthly" ? record.periodKey === period.periodKey : String(record.year) === period.periodKey
          );
          return [period.periodKey, aggregateBy(scopedRecords, "unidadeGestoraLabel", selectedMetric, 10)];
        })
      );

      return {
        label: subelemento.label,
        total: subelemento.value,
        color: colors[index % colors.length],
        points,
        topSubelementsOverall,
        topSubelementsByPeriod,
      };
    });

    return { periods, series };
  }, [activeTab, evolutionType, monthlyVisibleTotals, selectedMetric, topSubelementos, ugQuantity, visibleRecords, years]);

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

  useEffect(() => {
    if (activeTab !== "ugRanking") return;
    if (topSubelementTrendSeries.series.length === 0) {
      setSelectedEvolutionSubelement(null);
      return;
    }

    if (selectedRankingPeriod) {
      const leaderForPeriod = [...topSubelementTrendSeries.series]
        .map((line) => ({
          label: line.label,
          value: line.points.find((point) => point.periodKey === selectedRankingPeriod)?.value || 0,
        }))
        .sort((a, b) => b.value - a.value)[0];

      if (leaderForPeriod?.label) {
        setSelectedEvolutionSubelement(leaderForPeriod.label);
        return;
      }
    }

    if (!selectedEvolutionSubelement || !topSubelementTrendSeries.series.some((line) => line.label === selectedEvolutionSubelement)) {
      setSelectedEvolutionSubelement(topSubelementTrendSeries.series[0]?.label || null);
    }
  }, [activeTab, selectedEvolutionSubelement, selectedRankingPeriod, topSubelementTrendSeries.series]);

  const effectiveAlertThreshold = useMemo(() => {
    if (!effectiveAlertStartPeriod || !effectiveAlertEndPeriod) return alertThreshold;
    const startYear = String(effectiveAlertStartPeriod).slice(0, 4);
    const endYear = String(effectiveAlertEndPeriod).slice(0, 4);
    return startYear === endYear ? 10 : 50;
  }, [alertThreshold, effectiveAlertEndPeriod, effectiveAlertStartPeriod]);

  const itemVariationRows = useMemo(
    () =>
      activeTab === "itemVariation"
        ? buildItemVariationRows(
            filteredDetailedRecords,
            selectedMetric,
            effectiveAlertStartPeriod,
            effectiveAlertEndPeriod,
            activeVariationIPCA
          )
        : [],
    [activeTab, activeVariationIPCA, effectiveAlertEndPeriod, effectiveAlertStartPeriod, filteredDetailedRecords, selectedMetric]
  );

  const periodComparisonRows = useMemo(
    () =>
      activeTab === "alerts"
        ? buildGroupedVariationRows({
            records: visibleRecords,
            metricKey: selectedMetric,
            startPeriodKey: effectiveAlertStartPeriod,
            endPeriodKey: effectiveAlertEndPeriod,
            grouping: alertGrouping,
            threshold: effectiveAlertThreshold,
          })
        : [],
    [activeTab, alertGrouping, effectiveAlertEndPeriod, effectiveAlertStartPeriod, effectiveAlertThreshold, selectedMetric, visibleRecords]
  );

  const historicalAlertRows = useMemo(
    () =>
      activeTab === "alerts"
        ? buildHistoricalAverageRows({
            records: historyScopedRecords,
            metricKey: selectedMetric,
            endPeriodKey: effectiveAlertEndPeriod,
            grouping: alertGrouping,
            threshold: effectiveAlertThreshold,
          })
        : [],
    [activeTab, alertGrouping, effectiveAlertEndPeriod, effectiveAlertThreshold, historyScopedRecords, selectedMetric]
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
      { label: "Limite atual de alerta", value: `${effectiveAlertThreshold.toFixed(0)}%` },
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
  }, [effectiveAlertEndPeriod, effectiveAlertStartPeriod, effectiveAlertThreshold, historicalAlertRows, periodComparisonRows]);

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

  const exportPeriodLabel = useMemo(() => {
    const start = selectedPeriodStartInput?.replaceAll("/", "-") || "inicio";
    const end = selectedPeriodEndInput?.replaceAll("/", "-") || "fim";
    return `${start}_a_${end}`;
  }, [selectedPeriodEndInput, selectedPeriodStartInput]);

  const buildInsightRows = useCallback((cards) => (
    (cards || []).map((card) => ({
      Indicador: card.label,
      Valor: card.value,
    }))
  ), []);

  const buildRankingRows = useCallback((items, referenceTotal = null, comparisonMetaMap = null) => {
    const total = Number.isFinite(referenceTotal) && referenceTotal > 0
      ? referenceTotal
      : (items || []).reduce((acc, item) => acc + item.value, 0);

    return (items || []).map((item, index) => {
      const comparisonMeta = comparisonMetaMap?.get(item.label);
      return {
        Posição: index + 1,
        Item: item.label,
        Valor: item.value,
        "Valor Formatado": fmtCurrency(item.value),
        Percentual: total > 0 ? (item.value / total) * 100 : 0,
        "Percentual Formatado": total > 0 ? fmtPercent((item.value / total) * 100) : "--",
        "Variação %": comparisonMeta?.variationPercent ?? null,
        "Variação Formatada": comparisonMeta?.variationLabel ?? "--",
        IPCA: comparisonMeta?.ipcaValue ?? null,
      };
    });
  }, []);

  const buildTrendSeriesRows = useCallback((seriesData, periods) => {
    return (periods || []).map((periodKey) => {
      const row = {
        Período: formatPeriodLabel(periodKey),
        Chave: periodKey,
      };

      (seriesData || []).forEach((line) => {
        row[line.label] = line.points.find((point) => point.periodKey === periodKey)?.value || 0;
      });

      return row;
    });
  }, []);

  const buildMatrixExportRows = useCallback((rows, yearsList) => {
    return (rows || []).map((row) => {
      const exportRow = { Categoria: row.label };
      (yearsList || []).forEach((year, index) => {
        exportRow[String(year)] = row.yearValues[index] || 0;
      });
      exportRow.Total = row.total;
      return exportRow;
    });
  }, []);

  const buildAlertExportRows = useCallback((rows, baseLabel, compareLabel, totalValue) => {
    return (rows || []).map((row) => {
      const compareVal = row.endValue ?? row.currentValue;
      const impact = totalValue > 0 ? (compareVal / totalValue) * 100 : 0;
      return {
        Categoria: row.label,
        [baseLabel]: row.startValue ?? row.averageValue,
        [compareLabel]: compareVal,
        "Variação %": row.variationPercent,
        "Variação Formatada": row.variationLabel,
        "Impacto %": impact,
        Diferença: row.deltaValue,
        "Em Alerta": row.exceededThreshold ? "Sim" : "Não",
      };
    });
  }, []);

  const handleExportBlock = useCallback(async ({ title, format, targetRef, sheets }) => {
    const key = `${format}:${title}`;
    const fileBaseName = `custeio_${activeTab}_${title}_${exportPeriodLabel}`;
    const currentTabLabel = PAGE_TABS.find((tab) => tab.key === activeTab)?.label || activeTab;
    const readablePeriodLabel = `${selectedPeriodStartInput || "--"} a ${selectedPeriodEndInput || "--"}`;

    try {
      setExportingKey(key);

      if (format === "xlsx") {
        downloadWorkbook(sheets, fileBaseName);
        return;
      }

      if (format === "slides") {
        downloadPresentationPdf(fileBaseName, {
          reportTitle: `${currentTabLabel} · ${prettifyExportTitle(title)}`,
          panelLabel: prettifyExportTitle(title),
          periodLabel: readablePeriodLabel,
          metricLabel: currentMetricLabel,
          sheets,
        });
        return;
      }

      if (format === "pdf") {
        downloadStructuredPdf(fileBaseName, {
          reportTitle: `${currentTabLabel} · ${prettifyExportTitle(title)}`,
          panelLabel: prettifyExportTitle(title),
          periodLabel: readablePeriodLabel,
          metricLabel: currentMetricLabel,
          sheets,
        });
        return;
      }

      const canvas = await captureElementCanvas(targetRef?.current);
      if (format === "jpg") {
        downloadCanvasAsJpg(canvas, fileBaseName);
        return;
      }
    } catch (error) {
      console.error(error);
      window.alert("Não foi possível concluir a exportação deste bloco.");
    } finally {
      setExportingKey(null);
    }
  }, [activeTab, currentMetricLabel, exportPeriodLabel, selectedPeriodEndInput, selectedPeriodStartInput]);

  const exportBundles = useMemo(() => {
    const annualVariationRows = buildVariationRowsForExport({
      rows: yearlyVisibleTotals,
      showIPCA: true,
      ipcaAnnual,
      ipcaMonthly,
    }).map((row) => ({
      Ano: row.year,
      Total: row.value,
      "Total Formatado": fmtCurrency(row.value),
      "Variação %": row.variation,
      "Variação Formatada": fmtPercent(row.variation),
      IPCA: row.ipcaValue,
      Dissonância: row.dissonance,
    }));

    const monthlyVariationExportRows = buildVariationRowsForExport({
      rows: monthlyVariationRows,
      valueKey: "period",
      showIPCA: true,
      ipcaAnnual,
      ipcaMonthly,
    }).map((row) => ({
      Mês: formatPeriodLabel(row.period),
      Chave: row.period,
      Total: row.value,
      "Total Formatado": fmtCurrency(row.value),
      "Variação %": row.variation,
      "Variação Formatada": fmtPercent(row.variation),
      IPCA: row.ipcaValue,
      Dissonância: row.dissonance,
    }));

    const annualSummaryRows = annualRangeSummary
      ? [
          { Indicador: annualRangeSummary.firstLabel, Valor: annualRangeSummary.firstValue, "Valor Formatado": fmtCurrency(annualRangeSummary.firstValue) },
          { Indicador: annualRangeSummary.lastLabel, Valor: annualRangeSummary.lastValue, "Valor Formatado": fmtCurrency(annualRangeSummary.lastValue) },
          {
            Indicador: "Variação Total em Valor",
            Valor: annualRangeSummary.lastValue - annualRangeSummary.firstValue,
            "Valor Formatado": fmtCurrency(annualRangeSummary.lastValue - annualRangeSummary.firstValue),
          },
          {
            Indicador: "Variação Total em Percentual",
            Valor:
              annualRangeSummary.firstValue > 0
                ? ((annualRangeSummary.lastValue - annualRangeSummary.firstValue) / annualRangeSummary.firstValue) * 100
                : Number.NaN,
            "Valor Formatado":
              annualRangeSummary.firstValue > 0
                ? fmtPercent(((annualRangeSummary.lastValue - annualRangeSummary.firstValue) / annualRangeSummary.firstValue) * 100)
                : "--",
          },
        ]
      : [];

    const monthlySummaryRows = monthlyRangeSummary.firstPeriod && monthlyRangeSummary.lastPeriod
      ? [
          {
            Indicador: monthlyRangeSummary.firstPeriod.label,
            Valor: monthlyRangeSummary.firstPeriod.value,
            "Valor Formatado": fmtCurrency(monthlyRangeSummary.firstPeriod.value),
          },
          {
            Indicador: monthlyRangeSummary.lastPeriod.label,
            Valor: monthlyRangeSummary.lastPeriod.value,
            "Valor Formatado": fmtCurrency(monthlyRangeSummary.lastPeriod.value),
          },
          {
            Indicador: "Variação Total em Valor",
            Valor: monthlyRangeSummary.lastPeriod.value - monthlyRangeSummary.firstPeriod.value,
            "Valor Formatado": fmtCurrency(monthlyRangeSummary.lastPeriod.value - monthlyRangeSummary.firstPeriod.value),
          },
          {
            Indicador: "Variação Total em Percentual",
            Valor:
              monthlyRangeSummary.firstPeriod.value > 0
                ? ((monthlyRangeSummary.lastPeriod.value - monthlyRangeSummary.firstPeriod.value) / monthlyRangeSummary.firstPeriod.value) * 100
                : Number.NaN,
            "Valor Formatado":
              monthlyRangeSummary.firstPeriod.value > 0
                ? fmtPercent(((monthlyRangeSummary.lastPeriod.value - monthlyRangeSummary.firstPeriod.value) / monthlyRangeSummary.firstPeriod.value) * 100)
                : "--",
          },
        ]
      : [];

    const distributionRelationRows = distributionHover?.label === "Outras Despesas"
      ? distributionSelectionDetails.othersItems.map((item) => ({
          Item: item.label,
          Valor: item.value,
          "Valor Formatado": fmtCurrency(item.value),
        }))
      : (distributionSelectionDetails.relationInfo?.items || []).map((item) => ({
          Item: item.label,
          Valor: item.value,
          "Valor Formatado": fmtCurrency(item.value),
          Percentual: item.pct,
          "Percentual Formatado": fmtPercent(item.pct),
        }));

    const evolutionRows = buildTrendSeriesRows(topUgTrendSeries.series, topUgTrendSeries.periods);
    const evolutionSubRows = buildTrendSeriesRows(topSubelementTrendSeries.series, topSubelementTrendSeries.periods);

    return {
      overviewAnnual: [{ name: "serie_anual", rows: yearlyVisibleTotals.map((item) => ({ Ano: item.year, Valor: item.value, "Valor Formatado": fmtCurrency(item.value) })) }],
      overviewVariation: [{ name: "variacao_anual", rows: annualVariationRows }],
      overviewTopUg: [{ name: "top_ugs", rows: buildRankingRows(topUnidades.slice(0, 10)) }],
      overviewTopSub: [{ name: "top_subelementos", rows: buildRankingRows(topSubelementos.slice(0, 10)) }],
      overviewSummary: [{ name: "comparativo", rows: annualSummaryRows }],
      overviewHighlights: [{ name: "destaques", rows: buildInsightRows(annualHighlights) }],
      monthlySeries: [{ name: "serie_mensal", rows: monthlyVariationRows.map((item) => ({ Mês: formatPeriodLabel(item.period), Chave: item.period, Valor: item.value, "Valor Formatado": fmtCurrency(item.value) })) }],
      monthlyVariation: [{ name: "variacao_mensal", rows: monthlyVariationExportRows }],
      monthlySummary: [{ name: "comparativo_mensal", rows: monthlySummaryRows }],
      monthlyHighlightsMonth: [{ name: "destaques_mes", rows: buildInsightRows(monthlyHighlightsMaxMonth) }],
      monthlyHighlightsVariation: [{ name: "maior_variacao", rows: buildInsightRows(monthlyHighlightsMaxVariation) }],
      distributionSub: [{ name: "distribuicao_subelemento", rows: topSubelementos.map((item) => ({ Item: item.label, Valor: item.value, "Valor Formatado": fmtCurrency(item.value), Percentual: item.pct, "Percentual Formatado": fmtPercent(item.pct) })) }],
      distributionUg: [{ name: "distribuicao_ug", rows: topUnidades.map((item) => ({ Item: item.label, Valor: item.value, "Valor Formatado": fmtCurrency(item.value), Percentual: item.pct, "Percentual Formatado": fmtPercent(item.pct) })) }],
      distributionRelations: [{ name: "relacionamentos", rows: distributionRelationRows }],
      trendsSub: [{ name: "ranking_subelementos", rows: buildRankingRows(rankingSubelementos, rankingSubelementosReferenceTotal, rankingSubelementVariationMap) }],
      trendsUg: [{ name: "ranking_ugs", rows: buildRankingRows(rankingUnidades, rankingUnidadesReferenceTotal, rankingUgVariationMap) }],
      matrixSub: [{ name: "matriz_subelemento", rows: buildMatrixExportRows(matrixBySubelemento, years) }],
      matrixUg: [{ name: "matriz_ug", rows: buildMatrixExportRows(matrixByUnidade, years) }],
      evolution: [
        { name: "evolucao_ugs", rows: evolutionRows },
        { name: "evolucao_subelementos", rows: evolutionSubRows },
      ],
      alertsConfig: [{
        name: "configuracao_alertas",
        rows: [
          { Campo: "Agrupamento", Valor: alertGrouping },
          { Campo: "Limite de Alerta (%)", Valor: effectiveAlertThreshold },
          { Campo: "Período Inicial", Valor: effectiveAlertStartPeriod || "--" },
          { Campo: "Período Final", Valor: effectiveAlertEndPeriod || "--" },
        ],
      }],
      alertsInsights: [{ name: "insights_alertas", rows: buildInsightRows(alertInsightCards) }],
      alertsPeriod: [{ name: "alertas_periodo", rows: buildAlertExportRows(periodComparisonRows.slice(0, 12), effectiveAlertStartPeriod || "Início", effectiveAlertEndPeriod || "Fim", periodEndTotal) }],
      alertsHistorical: [{ name: "alertas_historicos", rows: buildAlertExportRows(historicalAlertRows.slice(0, 12), "Média 12 Meses", effectiveAlertEndPeriod || "Período Final", periodEndTotal) }],
      creditorConcentration: [{
        name: "concentracao_ug_subelemento",
        rows: creditorConcentrationRows.map((row) => ({
          UG: row.ug,
          "Descrição UG": row.ugDescricao,
          Subelemento: row.subelemento,
          "Descrição Subelemento": row.subelementoDescricao,
          Empenhado: row.empenhado,
          "Empenhado Formatado": fmtCurrency(row.empenhado),
          Liquidado: row.liquidado,
          "Liquidado Formatado": fmtCurrency(row.liquidado),
          Pago: row.pago,
          "Pago Formatado": fmtCurrency(row.pago),
          Registros: row.registros,
        })),
      }],
      preLiquidation: [{
        name: "pagamentos_pre_liquidacao",
        rows: preLiquidationPaymentRows.map((row) => ({
          "Unidade Gestora": row.unidadeGestoraLabel || "--",
          Subelemento: row.subelementoLabel || "--",
          Credor: row.creditorLabel || "--",
          Empenho: row.empenhoNumber || "--",
          "Ordem Bancária": row.ordemBancariaNumber || "--",
          "Data Pagamento": formatDetailedDate(row.paymentDate),
          "Data Liquidação": formatDetailedDate(row.liquidationDate),
          "Valor Pago": row.vlpago || row.value,
          "Valor Pago Formatado": fmtCurrency(row.vlpago || row.value),
        })),
      }],
      withoutContract: [{
        name: "despesas_sem_contrato",
        rows: missingContractRows.map((row) => ({
          "Unidade Gestora": row.unidadeGestoraLabel || "--",
          Subelemento: row.subelementoLabel || "--",
          Empenhado: row.vlempenhado,
          Liquidado: row.vlliquidado,
          Pago: row.vlpago,
        })),
      }],
      itemServices: [{
        name: "itens_servicos",
        rows: itemServiceRows.map((row) => ({
          Descrição: row.description,
          Classificação: row.classification,
          "Objeto Contrato": row.contractObject,
          Quantidade: row.quantity,
          "Valor Unitário": row.unitValue,
          "Valor Total": row.totalValue,
          UG: row.unidadeGestoraLabel,
        })),
      }],
      itemVariation: [{
        name: "variacao_itens_servicos",
        rows: itemVariationRows.map((row) => ({
          Descrição: row.description,
          UG: row.unidadeGestoraLabel,
          "Valor Inicial": row.startValue,
          "Valor Final": row.endValue,
          "Variação %": row.variationPercent,
          IPCA: row.ipcaValue,
        })),
      }],
      procurementModes: [{
        name: "modalidades",
        rows: procurementModeRows.map((row) => ({
          Categoria: row.category,
          Modalidade: row.mode,
          Total: row.totalValue,
        })),
      }],
      contracts: [{
        name: "contratos_vigencias",
        rows: contractRows.map((row) => ({
          Contrato: row.contractNumber,
          UG: row.unidadeGestoraLabel,
          "Data Início": formatDetailedDate(row.contractStartDate),
          "Data Fim": formatDetailedDate(row.contractEndDate),
          "Próximo do Vencimento": row.isExpiringSoon ? "Sim" : "Não",
        })),
      }],
    };
  }, [
    alertGrouping,
    alertInsightCards,
    alertThreshold,
    annualHighlights,
    annualRangeSummary,
    buildAlertExportRows,
    buildInsightRows,
    buildMatrixExportRows,
    buildRankingRows,
    buildTrendSeriesRows,
    creditorConcentrationRows,
    contractRows,
    distributionHover,
    distributionSelectionDetails.othersItems,
    distributionSelectionDetails.relationInfo,
    effectiveAlertEndPeriod,
    effectiveAlertStartPeriod,
    historicalAlertRows,
    ipcaAnnual,
    ipcaMonthly,
    matrixBySubelemento,
    matrixByUnidade,
    monthlyHighlightsMaxMonth,
    monthlyHighlightsMaxVariation,
    monthlyRangeSummary.firstPeriod,
    monthlyRangeSummary.lastPeriod,
    monthlyVariationRows,
    periodComparisonRows,
    periodEndTotal,
    procurementModeRows,
    preLiquidationPaymentRows,
    rankingSubelementos,
    rankingSubelementVariationMap,
    rankingSubelementosReferenceTotal,
    rankingUnidades,
    rankingUgVariationMap,
    rankingUnidadesReferenceTotal,
    itemServiceRows,
    itemVariationRows,
    missingContractRows,
    topSubelementTrendSeries.periods,
    topSubelementTrendSeries.series,
    topSubelementos,
    topUgTrendSeries.periods,
    topUgTrendSeries.series,
    topUnidades,
    years,
    yearlyVisibleTotals,
  ]);

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
    setSelectedEvolutionSubelement(null);
    setEvolutionView("ug");
    setAlertThreshold(10);
    setAlertGrouping("subelemento");
    setGlobalSearch("");
    setAppliedSearch("");
    setMatrixSearch("");
    setElementoSearch("");
    setSubelementoSearch("");
    setUnidadeSearch("");
    setProcurementModeSearch("");
    setSelectedProcurementModes([]);
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

  const toggleProcurementMode = (value) => {
    setSelectedProcurementModes((current) =>
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
            {isRefreshing ? "Sincronizando automaticamente com o portal..." : `Base carregada em: ${updatedAtLabel}`}
          </span>
          {lastAttemptLabel ? <span className="bi-topbar-status">{`Última verificação: ${lastAttemptLabel}`}</span> : null}
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
              <MultiSelectChecklist
                label="Modalidade de Licitação"
                placeholder="Buscar modalidade..."
                emptySelectionLabel="Selecionar modalidade"
                options={procurementModeOptions}
                selectedValues={selectedProcurementModes}
                searchValue={procurementModeSearch}
                onSearchChange={setProcurementModeSearch}
                onToggleValue={toggleProcurementMode}
                onClear={() => setSelectedProcurementModes([])}
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
            <ExportableBlock
              title="visao-anual_bloco_principal"
              targetRef={overviewMainSectionExportRef}
              sheets={[...exportBundles.overviewAnnual, ...exportBundles.overviewVariation]}
              onExport={handleExportBlock}
              busy={exportingKey === "pdf:visao-anual_bloco_principal" || exportingKey === "jpg:visao-anual_bloco_principal" || exportingKey === "xlsx:visao-anual_bloco_principal"}
              buttonLabel="Baixar bloco"
              variant="section"
            >
              <section className="bi-grid bi-grid-main">
                <ExportableBlock
                  title="serie_anual"
                  targetRef={overviewAnnualExportRef}
                  sheets={exportBundles.overviewAnnual}
                  onExport={handleExportBlock}
                  busy={exportingKey === "pdf:serie_anual" || exportingKey === "jpg:serie_anual" || exportingKey === "xlsx:serie_anual"}
                >
                  <AnnualBars items={yearlyVisibleTotals} metricLabel={currentMetricLabel} />
                </ExportableBlock>
                <ExportableBlock
                  title="variacao_anual"
                  targetRef={overviewVariationExportRef}
                  sheets={exportBundles.overviewVariation}
                  onExport={handleExportBlock}
                  busy={exportingKey === "pdf:variacao_anual" || exportingKey === "jpg:variacao_anual" || exportingKey === "xlsx:variacao_anual"}
                >
                  <VariationTable
                    rows={yearlyVisibleTotals}
                    showIPCA
                    ipcaAnnual={ipcaAnnual}
                    ipcaMonthly={ipcaMonthly}
                    ipcaEstimated={ipcaAnnualEstimated}
                  />
                </ExportableBlock>
              </section>
            </ExportableBlock>
            <ExportableBlock
              title="visao-anual_bloco_ranking"
              targetRef={overviewRankingSectionExportRef}
              sheets={[...exportBundles.overviewTopUg, ...exportBundles.overviewTopSub]}
              onExport={handleExportBlock}
              busy={exportingKey === "pdf:visao-anual_bloco_ranking" || exportingKey === "jpg:visao-anual_bloco_ranking" || exportingKey === "xlsx:visao-anual_bloco_ranking"}
              buttonLabel="Baixar bloco"
              variant="section"
            >
              <section className="bi-grid">
                <ExportableBlock
                  title="top_ugs_anual"
                  targetRef={overviewTopUgExportRef}
                  sheets={exportBundles.overviewTopUg}
                  onExport={handleExportBlock}
                  busy={exportingKey === "pdf:top_ugs_anual" || exportingKey === "jpg:top_ugs_anual" || exportingKey === "xlsx:top_ugs_anual"}
                >
                  <TopRankingPanel title={`10 UGs com Maior Valor ${currentMetricLabel}`} items={topUnidades} />
                </ExportableBlock>
                <ExportableBlock
                  title="top_subelementos_anual"
                  targetRef={overviewTopSubExportRef}
                  sheets={exportBundles.overviewTopSub}
                  onExport={handleExportBlock}
                  busy={exportingKey === "pdf:top_subelementos_anual" || exportingKey === "jpg:top_subelementos_anual" || exportingKey === "xlsx:top_subelementos_anual"}
                >
                  <TopRankingPanel title={`10 Subelementos com Maior Valor ${currentMetricLabel}`} items={topSubelementos} />
                </ExportableBlock>
              </section>
            </ExportableBlock>
            <ExportableBlock
              title="visao-anual_bloco_destaques"
              targetRef={overviewInsightsSectionExportRef}
              sheets={[...exportBundles.overviewSummary, ...exportBundles.overviewHighlights]}
              onExport={handleExportBlock}
              busy={exportingKey === "pdf:visao-anual_bloco_destaques" || exportingKey === "jpg:visao-anual_bloco_destaques" || exportingKey === "xlsx:visao-anual_bloco_destaques"}
              buttonLabel="Baixar bloco"
              variant="section"
            >
              <section className="bi-grid">
                <ExportableBlock
                  title="comparativo_anual"
                  targetRef={overviewSummaryExportRef}
                  sheets={exportBundles.overviewSummary}
                  onExport={handleExportBlock}
                  busy={exportingKey === "pdf:comparativo_anual" || exportingKey === "jpg:comparativo_anual" || exportingKey === "xlsx:comparativo_anual"}
                >
                  <MonthlySummaryPanel
                    title="Comparativo do Período Selecionado"
                    firstLabel={annualRangeSummary?.firstLabel}
                    lastLabel={annualRangeSummary?.lastLabel}
                    firstValue={annualRangeSummary?.firstValue}
                    lastValue={annualRangeSummary?.lastValue}
                    metricLabel={currentMetricLabel}
                  />
                </ExportableBlock>
                <ExportableBlock
                  title="destaques_anuais"
                  targetRef={overviewInsightsExportRef}
                  sheets={exportBundles.overviewHighlights}
                  onExport={handleExportBlock}
                  busy={exportingKey === "pdf:destaques_anuais" || exportingKey === "jpg:destaques_anuais" || exportingKey === "xlsx:destaques_anuais"}
                >
                  <InsightCards cards={annualHighlights} />
                </ExportableBlock>
              </section>
            </ExportableBlock>
          </>
        )}

        {activeTab === "monthly" && (
          <>
            <ExportableBlock
              title="visao-mensal_bloco_principal"
              targetRef={monthlyMainSectionExportRef}
              sheets={[...exportBundles.monthlySeries, ...exportBundles.monthlyVariation]}
              onExport={handleExportBlock}
              busy={exportingKey === "pdf:visao-mensal_bloco_principal" || exportingKey === "jpg:visao-mensal_bloco_principal" || exportingKey === "xlsx:visao-mensal_bloco_principal"}
              buttonLabel="Baixar bloco"
              variant="section"
            >
              <section className="bi-grid bi-grid-main">
                <ExportableBlock
                  title="serie_mensal"
                  targetRef={monthlySeriesExportRef}
                  sheets={exportBundles.monthlySeries}
                  onExport={handleExportBlock}
                  busy={exportingKey === "pdf:serie_mensal" || exportingKey === "jpg:serie_mensal" || exportingKey === "xlsx:serie_mensal"}
                >
                  <PeriodBars items={monthlyVariationRows} metricLabel={currentMetricLabel} title="Série mensal" valueKey="period" />
                </ExportableBlock>
                <ExportableBlock
                  title="variacao_mensal"
                  targetRef={monthlyVariationExportRef}
                  sheets={exportBundles.monthlyVariation}
                  onExport={handleExportBlock}
                  busy={exportingKey === "pdf:variacao_mensal" || exportingKey === "jpg:variacao_mensal" || exportingKey === "xlsx:variacao_mensal"}
                >
                  <VariationTable
                    rows={monthlyVariationRows}
                    title="Variação mensal"
                    periodLabel="Mês"
                    valueKey="period"
                    showIPCA
                    ipcaAnnual={ipcaAnnual}
                    ipcaMonthly={ipcaMonthly}
                    ipcaEstimated={ipcaMonthlyEstimated}
                  />
                </ExportableBlock>
              </section>
            </ExportableBlock>
            <ExportableBlock
              title="visao-mensal_bloco_destaques"
              targetRef={monthlySummarySectionExportRef}
              sheets={[...exportBundles.monthlySummary, ...exportBundles.monthlyHighlightsMonth]}
              onExport={handleExportBlock}
              busy={exportingKey === "pdf:visao-mensal_bloco_destaques" || exportingKey === "jpg:visao-mensal_bloco_destaques" || exportingKey === "xlsx:visao-mensal_bloco_destaques"}
              buttonLabel="Baixar bloco"
              variant="section"
            >
              <section className="bi-grid">
                <ExportableBlock
                  title="comparativo_mensal"
                  targetRef={monthlySummaryExportRef}
                  sheets={exportBundles.monthlySummary}
                  onExport={handleExportBlock}
                  busy={exportingKey === "pdf:comparativo_mensal" || exportingKey === "jpg:comparativo_mensal" || exportingKey === "xlsx:comparativo_mensal"}
                >
                  <MonthlySummaryPanel
                    title="Comparativo do Período Selecionado"
                    firstPeriod={monthlyRangeSummary.firstPeriod}
                    lastPeriod={monthlyRangeSummary.lastPeriod}
                    metricLabel={currentMetricLabel}
                  />
                </ExportableBlock>
                <ExportableBlock
                  title="destaques_mensais"
                  targetRef={monthlyHighlightsMonthExportRef}
                  sheets={exportBundles.monthlyHighlightsMonth}
                  onExport={handleExportBlock}
                  busy={exportingKey === "pdf:destaques_mensais" || exportingKey === "jpg:destaques_mensais" || exportingKey === "xlsx:destaques_mensais"}
                >
                  <InsightCards title="Informações de Destaque" cards={monthlyHighlightsMaxMonth} />
                </ExportableBlock>
              </section>
            </ExportableBlock>
            <ExportableBlock
              title="visao-mensal_bloco_maior_variacao"
              targetRef={monthlyVariationSectionExportRef}
              sheets={exportBundles.monthlyHighlightsVariation}
              onExport={handleExportBlock}
              busy={exportingKey === "pdf:visao-mensal_bloco_maior_variacao" || exportingKey === "jpg:visao-mensal_bloco_maior_variacao" || exportingKey === "xlsx:visao-mensal_bloco_maior_variacao"}
              buttonLabel="Baixar bloco"
              variant="section"
            >
              <section className="bi-grid bi-grid-single">
                <ExportableBlock
                  title="maior_variacao_mensal"
                  targetRef={monthlyHighlightsVariationExportRef}
                  sheets={exportBundles.monthlyHighlightsVariation}
                  onExport={handleExportBlock}
                  busy={exportingKey === "pdf:maior_variacao_mensal" || exportingKey === "jpg:maior_variacao_mensal" || exportingKey === "xlsx:maior_variacao_mensal"}
                >
                  <InsightCards title="Maior Variação" cards={monthlyHighlightsMaxVariation} />
                </ExportableBlock>
              </section>
            </ExportableBlock>
          </>
        )}

        {activeTab === "distribution" && (
          <>
            <ExportableBlock
              title="distribuicao_bloco_principal"
              targetRef={distributionGridExportRef}
              sheets={[...exportBundles.distributionSub, ...exportBundles.distributionUg]}
              onExport={handleExportBlock}
              busy={exportingKey === "pdf:distribuicao_bloco_principal" || exportingKey === "jpg:distribuicao_bloco_principal" || exportingKey === "xlsx:distribuicao_bloco_principal"}
              buttonLabel="Baixar bloco"
              variant="section"
            >
              <section ref={distributionSectionRef} className="bi-grid">
                <ExportableBlock
                  title="distribuicao_subelemento"
                  targetRef={distributionSubExportRef}
                  sheets={exportBundles.distributionSub}
                  onExport={handleExportBlock}
                  busy={exportingKey === "pdf:distribuicao_subelemento" || exportingKey === "jpg:distribuicao_subelemento" || exportingKey === "xlsx:distribuicao_subelemento"}
                >
                  <PiePanel
                    title={`${currentMetricNoun} por Subelemento`}
                    items={topSubelementos}
                    panelKey="subelemento"
                    hoveredState={distributionHover}
                    onHoverChange={setDistributionHover}
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
                </ExportableBlock>
                <ExportableBlock
                  title="distribuicao_ug"
                  targetRef={distributionUgExportRef}
                  sheets={exportBundles.distributionUg}
                  onExport={handleExportBlock}
                  busy={exportingKey === "pdf:distribuicao_ug" || exportingKey === "jpg:distribuicao_ug" || exportingKey === "xlsx:distribuicao_ug"}
                >
                  <PiePanel
                    title={`${currentMetricNoun} por Unidade Gestora`}
                    items={topUnidades}
                    panelKey="unidade"
                    hoveredState={distributionHover}
                    onHoverChange={setDistributionHover}
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
                </ExportableBlock>
              </section>
            </ExportableBlock>
            <ExportableBlock
              title="distribuicao_bloco_relacoes"
              targetRef={distributionRelationsExportRef}
              sheets={exportBundles.distributionRelations}
              onExport={handleExportBlock}
              busy={exportingKey === "pdf:distribuicao_bloco_relacoes" || exportingKey === "jpg:distribuicao_bloco_relacoes" || exportingKey === "xlsx:distribuicao_bloco_relacoes"}
              buttonLabel="Baixar bloco"
              variant="section"
            >
              <section className="bi-grid bi-grid-single">
                <ExportableBlock
                  title="relacionamentos_distribuicao"
                  targetRef={distributionRelationCardExportRef}
                  sheets={exportBundles.distributionRelations}
                  onExport={handleExportBlock}
                  busy={exportingKey === "pdf:relacionamentos_distribuicao" || exportingKey === "jpg:relacionamentos_distribuicao" || exportingKey === "xlsx:relacionamentos_distribuicao"}
                >
                  <DistributionRelationshipCard
                    hoveredState={distributionHover}
                    relationInfo={distributionSelectionDetails.relationInfo}
                    relationTargetLabel={distributionSelectionDetails.relationTargetLabel}
                    othersItems={distributionSelectionDetails.othersItems}
                    onClear={() => setDistributionHover(null)}
                  />
                </ExportableBlock>
              </section>
            </ExportableBlock>
          </>
        )}

        {activeTab === "trends" && (
          <ExportableBlock
            title="ranking_bloco_principal"
            targetRef={trendsSectionExportRef}
            sheets={[...exportBundles.trendsSub, ...exportBundles.trendsUg]}
            onExport={handleExportBlock}
            busy={exportingKey === "pdf:ranking_bloco_principal" || exportingKey === "jpg:ranking_bloco_principal" || exportingKey === "xlsx:ranking_bloco_principal"}
            buttonLabel="Baixar bloco"
            variant="section"
          >
            <section ref={rankingSectionRef} className="bi-grid">
              <ExportableBlock
                title="ranking_subelementos"
                targetRef={trendsSubExportRef}
                sheets={exportBundles.trendsSub}
                onExport={handleExportBlock}
                busy={exportingKey === "pdf:ranking_subelementos" || exportingKey === "jpg:ranking_subelementos" || exportingKey === "xlsx:ranking_subelementos"}
              >
                <BarList
                  title={`Subelementos com Maior ${currentMetricNoun}`}
                  items={rankingSubelementos}
                  onClickItem={setSelectedSubelementInRanking}
                  selectedItem={selectedSubelementInRanking}
                  relatedLabels={rankingSubelementoRelatedLabels}
                  referenceTotal={rankingSubelementosReferenceTotal}
                  comparisonMetaMap={rankingSubelementVariationMap}
                  limitHeight
                />
              </ExportableBlock>
              <ExportableBlock
                title="ranking_ugs"
                targetRef={trendsUgExportRef}
                sheets={exportBundles.trendsUg}
                onExport={handleExportBlock}
                busy={exportingKey === "pdf:ranking_ugs" || exportingKey === "jpg:ranking_ugs" || exportingKey === "xlsx:ranking_ugs"}
              >
                <BarList
                  title={`Unidades Gestoras com Maior ${currentMetricNoun}`}
                  items={rankingUnidades}
                  onClickItem={setSelectedUgInRanking}
                  selectedItem={selectedUgInRanking}
                  relatedLabels={rankingUgRelatedLabels}
                  referenceTotal={rankingUnidadesReferenceTotal}
                  comparisonMetaMap={rankingUgVariationMap}
                  limitHeight
                />
              </ExportableBlock>
            </section>
          </ExportableBlock>
        )}

        {activeTab === "matrix" && (
          <ExportableBlock
            title="matriz_bloco_principal"
            targetRef={matrixSectionExportRef}
            sheets={[...exportBundles.matrixSub, ...exportBundles.matrixUg]}
            onExport={handleExportBlock}
            busy={exportingKey === "pdf:matriz_bloco_principal" || exportingKey === "jpg:matriz_bloco_principal" || exportingKey === "xlsx:matriz_bloco_principal"}
            buttonLabel="Baixar bloco"
            variant="section"
          >
            <section className="bi-grid bi-grid-single">
              <ExportableBlock
                title="matriz_subelementos"
                targetRef={matrixSubExportRef}
                sheets={exportBundles.matrixSub}
                onExport={handleExportBlock}
                busy={exportingKey === "pdf:matriz_subelementos" || exportingKey === "jpg:matriz_subelementos" || exportingKey === "xlsx:matriz_subelementos"}
              >
                <MatrixPanelView
                  title="Valores por Subelemento e Ano"
                  rows={matrixBySubelemento}
                  years={years}
                  matrixSearch={matrixSearch}
                  onMatrixSearch={setMatrixSearch}
                  fmtCompact={fmtCompact}
                  fmtCurrency={fmtCurrency}
                />
              </ExportableBlock>
              <ExportableBlock
                title="matriz_ugs"
                targetRef={matrixUgExportRef}
                sheets={exportBundles.matrixUg}
                onExport={handleExportBlock}
                busy={exportingKey === "pdf:matriz_ugs" || exportingKey === "jpg:matriz_ugs" || exportingKey === "xlsx:matriz_ugs"}
              >
                <MatrixPanelView
                  title="Valores por Unidade Gestora e Ano"
                  rows={matrixByUnidade}
                  years={years}
                  matrixSearch={matrixSearch}
                  onMatrixSearch={setMatrixSearch}
                  fmtCompact={fmtCompact}
                  fmtCurrency={fmtCurrency}
                />
              </ExportableBlock>
            </section>
          </ExportableBlock>
        )}

        {activeTab === "ugRanking" && (
          <ExportableBlock
            title="evolucao_bloco_principal"
            targetRef={evolutionSectionExportRef}
            sheets={exportBundles.evolution}
            onExport={handleExportBlock}
            busy={exportingKey === "pdf:evolucao_bloco_principal" || exportingKey === "jpg:evolucao_bloco_principal" || exportingKey === "xlsx:evolucao_bloco_principal"}
            buttonLabel="Baixar bloco"
            variant="section"
          >
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
              <div className="bi-filter-group">
                <label>Recorte da Evolução</label>
                <div className="bi-toggle-group">
                  <button
                    type="button"
                    className={evolutionView === "ug" ? "is-active" : ""}
                    onClick={() => setEvolutionView("ug")}
                  >
                    Top 10 UGs
                  </button>
                  <button
                    type="button"
                    className={evolutionView === "subelemento" ? "is-active" : ""}
                    onClick={() => setEvolutionView("subelemento")}
                  >
                    Top 10 Subelementos
                  </button>
                </div>
              </div>
            </div>

            <section className="bi-grid bi-grid-single">
              {evolutionView === "ug" ? (
                <ExportableBlock
                  title="evolucao_top_ugs"
                  targetRef={evolutionPanelExportRef}
                  sheets={exportBundles.evolution}
                  onExport={handleExportBlock}
                  busy={exportingKey === "pdf:evolucao_top_ugs" || exportingKey === "jpg:evolucao_top_ugs" || exportingKey === "xlsx:evolucao_top_ugs"}
                >
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
                    dominantLabel="UG dominante"
                    monitoredLabel="UGs monitoradas"
                    detailLabel="subelementos"
                    emptyDetailMessage="Sem subelementos para o recorte selecionado."
                  />
                </ExportableBlock>
              ) : (
                <ExportableBlock
                  title="evolucao_top_subelementos"
                  targetRef={evolutionSubPanelExportRef}
                  sheets={exportBundles.evolution}
                  onExport={handleExportBlock}
                  busy={exportingKey === "pdf:evolucao_top_subelementos" || exportingKey === "jpg:evolucao_top_subelementos" || exportingKey === "xlsx:evolucao_top_subelementos"}
                >
                  <TopUgTrendLinesPanel
                    title={`Evolução ${evolutionType === "monthly" ? "Mensal" : "Anual"} (Top 10 Subelementos)`}
                    periods={topSubelementTrendSeries.periods}
                    series={topSubelementTrendSeries.series}
                    metricLabel={currentMetricLabel}
                    large
                    selectedPeriodKey={selectedRankingPeriod}
                    onSelectPeriod={setSelectedRankingPeriod}
                    selectedSeriesLabel={selectedEvolutionSubelement}
                    onSelectSeries={setSelectedEvolutionSubelement}
                    dominantLabel="Subelemento dominante"
                    monitoredLabel="Subelementos monitorados"
                    detailLabel="UGs"
                    emptyDetailMessage="Sem UGs para o recorte selecionado."
                  />
                </ExportableBlock>
              )}
            </section>
          </>
          </ExportableBlock>
        )}

        {activeTab === "alerts" && (
          <>
            <ExportableBlock
              title="alertas_bloco_superior"
              targetRef={alertsTopSectionExportRef}
              sheets={[...exportBundles.alertsConfig, ...exportBundles.alertsInsights]}
              onExport={handleExportBlock}
              busy={exportingKey === "pdf:alertas_bloco_superior" || exportingKey === "jpg:alertas_bloco_superior" || exportingKey === "xlsx:alertas_bloco_superior"}
              buttonLabel="Baixar bloco"
              variant="section"
            >
              <section className="bi-grid">
                <ExportableBlock
                  title="alertas_configuracao"
                  targetRef={alertsConfigExportRef}
                  sheets={exportBundles.alertsConfig}
                  onExport={handleExportBlock}
                  busy={exportingKey === "pdf:alertas_configuracao" || exportingKey === "jpg:alertas_configuracao" || exportingKey === "xlsx:alertas_configuracao"}
                >
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
                          value={effectiveAlertThreshold}
                          onChange={(e) => setAlertThreshold(Math.max(0, Number(e.target.value) || 0))}
                          disabled
                        />
                      </div>
                    </div>

                    <div className="bi-narrative">
                      <p>
                        Esta trilha compara o primeiro e o último período do recorte atual e também verifica se o último
                        período ficou acima da média dos 12 meses anteriores.
                      </p>
                      <p>
                        Regra automática aplicada: 10% para leituras mensais e 50% para leituras anuais.
                      </p>
                    </div>
                  </section>
                </ExportableBlock>

                <ExportableBlock
                  title="alertas_destaques"
                  targetRef={alertsInsightsExportRef}
                  sheets={exportBundles.alertsInsights}
                  onExport={handleExportBlock}
                  busy={exportingKey === "pdf:alertas_destaques" || exportingKey === "jpg:alertas_destaques" || exportingKey === "xlsx:alertas_destaques"}
                >
                  <InsightCards cards={alertInsightCards} />
                </ExportableBlock>
              </section>
            </ExportableBlock>

            <ExportableBlock
              title="alertas_bloco_tabelas"
              targetRef={alertsTablesSectionExportRef}
              sheets={[...exportBundles.alertsPeriod, ...exportBundles.alertsHistorical]}
              onExport={handleExportBlock}
              busy={exportingKey === "pdf:alertas_bloco_tabelas" || exportingKey === "jpg:alertas_bloco_tabelas" || exportingKey === "xlsx:alertas_bloco_tabelas"}
              buttonLabel="Baixar bloco"
              variant="section"
            >
              <section className="bi-grid bi-grid-single">
                <ExportableBlock
                  title="alertas_periodo"
                  targetRef={alertsPeriodExportRef}
                  sheets={exportBundles.alertsPeriod}
                  onExport={handleExportBlock}
                  busy={exportingKey === "pdf:alertas_periodo" || exportingKey === "jpg:alertas_periodo" || exportingKey === "xlsx:alertas_periodo"}
                >
                  <AlertTable
                    title="Variações Acima do Limite entre o Início e o Fim do Recorte"
                    rows={periodComparisonRows.slice(0, 12)}
                    baseLabel={effectiveAlertStartPeriod || "Início"}
                    compareLabel={effectiveAlertEndPeriod || "Fim"}
                    emptyMessage="Selecione um intervalo com ao menos dois períodos para montar os alertas de comparação."
                    totalValue={periodEndTotal}
                  />
                </ExportableBlock>
                <ExportableBlock
                  title="alertas_historicos"
                  targetRef={alertsHistoricalExportRef}
                  sheets={exportBundles.alertsHistorical}
                  onExport={handleExportBlock}
                  busy={exportingKey === "pdf:alertas_historicos" || exportingKey === "jpg:alertas_historicos" || exportingKey === "xlsx:alertas_historicos"}
                >
                  <AlertTable
                    title="Desvios Acima da Média Histórica"
                    rows={historicalAlertRows.slice(0, 12)}
                    baseLabel="Média 12 Meses"
                    compareLabel={effectiveAlertEndPeriod || "Período Final"}
                    emptyMessage="Ainda não há histórico suficiente para comparar o último período com a média anterior."
                    totalValue={periodEndTotal}
                  />
                </ExportableBlock>
              </section>
            </ExportableBlock>
          </>
        )}

        {activeTab === "creditorConcentration" && (
          <ExportableBlock
            title="concentracao_ug_subelemento"
            targetRef={creditorConcentrationExportRef}
            sheets={exportBundles.creditorConcentration}
            onExport={handleExportBlock}
            busy={exportingKey === "pdf:concentracao_ug_subelemento" || exportingKey === "jpg:concentracao_ug_subelemento" || exportingKey === "xlsx:concentracao_ug_subelemento"}
            buttonLabel="Baixar bloco"
            variant="section"
          >
            <section className="bi-grid bi-grid-single">
              <CreditorConcentrationTable rows={creditorConcentrationRows} />
            </section>
          </ExportableBlock>
        )}

        {activeTab === "withoutContract" && (
          <ExportableBlock
            title="despesas_sem_contrato"
            targetRef={withoutContractExportRef}
            sheets={exportBundles.withoutContract}
            onExport={handleExportBlock}
            busy={exportingKey === "pdf:despesas_sem_contrato" || exportingKey === "jpg:despesas_sem_contrato" || exportingKey === "xlsx:despesas_sem_contrato"}
            buttonLabel="Baixar bloco"
            variant="section"
          >
            <section className="bi-grid bi-grid-single">
              <MissingContractTable rows={missingContractRows} hasDetailedData={detailedRecords.length > 0} />
            </section>
          </ExportableBlock>
        )}

        {activeTab === "preLiquidationPayments" && (
          <ExportableBlock
            title="pagamentos_pre_liquidacao"
            targetRef={preLiquidationExportRef}
            sheets={exportBundles.preLiquidation}
            onExport={handleExportBlock}
            busy={exportingKey === "pdf:pagamentos_pre_liquidacao" || exportingKey === "jpg:pagamentos_pre_liquidacao" || exportingKey === "xlsx:pagamentos_pre_liquidacao"}
            buttonLabel="Baixar bloco"
            variant="section"
          >
            <section className="bi-grid bi-grid-single">
              <PreLiquidationPaymentTable
                rows={preLiquidationPaymentRows}
                hasDetailedData={detailedRecords.length > 0}
              />
            </section>
          </ExportableBlock>
        )}

        {activeTab === "itemServices" && (
          <ExportableBlock
            title="itens_servicos"
            targetRef={itemServicesExportRef}
            sheets={exportBundles.itemServices}
            onExport={handleExportBlock}
            busy={exportingKey === "pdf:itens_servicos" || exportingKey === "jpg:itens_servicos" || exportingKey === "xlsx:itens_servicos"}
            buttonLabel="Baixar bloco"
            variant="section"
          >
            <section className="bi-grid bi-grid-single">
              <ItemServiceTable rows={itemServiceRows} hasDetailedData={detailedRecords.length > 0} metricLabel={currentMetricLabel} />
            </section>
          </ExportableBlock>
        )}

        {activeTab === "itemVariation" && (
          <ExportableBlock
            title="variacao_itens_servicos"
            targetRef={itemVariationExportRef}
            sheets={exportBundles.itemVariation}
            onExport={handleExportBlock}
            busy={exportingKey === "pdf:variacao_itens_servicos" || exportingKey === "jpg:variacao_itens_servicos" || exportingKey === "xlsx:variacao_itens_servicos"}
            buttonLabel="Baixar bloco"
            variant="section"
          >
            <section className="bi-grid bi-grid-single">
              <ItemVariationTable
                rows={itemVariationRows}
                hasDetailedData={detailedRecords.length > 0}
                startPeriodKey={effectiveAlertStartPeriod}
                endPeriodKey={effectiveAlertEndPeriod}
              />
            </section>
          </ExportableBlock>
        )}

        {activeTab === "procurementModes" && (
          <ExportableBlock
            title="modalidades"
            targetRef={procurementModesExportRef}
            sheets={exportBundles.procurementModes}
            onExport={handleExportBlock}
            busy={exportingKey === "pdf:modalidades" || exportingKey === "jpg:modalidades" || exportingKey === "xlsx:modalidades"}
            buttonLabel="Baixar bloco"
            variant="section"
          >
            <section className="bi-grid bi-grid-single">
              <ProcurementModeTable rows={procurementModeRows} hasDetailedData={detailedRecords.length > 0} />
            </section>
          </ExportableBlock>
        )}

        {activeTab === "contracts" && (
          <ExportableBlock
            title="contratos_vigencias"
            targetRef={contractsExportRef}
            sheets={exportBundles.contracts}
            onExport={handleExportBlock}
            busy={exportingKey === "pdf:contratos_vigencias" || exportingKey === "jpg:contratos_vigencias" || exportingKey === "xlsx:contratos_vigencias"}
            buttonLabel="Baixar bloco"
            variant="section"
          >
            <section className="bi-grid bi-grid-single">
              <ContractsTable rows={contractRows} hasDetailedData={detailedRecords.length > 0} />
            </section>
          </ExportableBlock>
        )}
      </div>
    </div>
  );
}




import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "public", "data");
const outFile = path.join(outDir, "custeio-oficial.json");

const official = {
  apiUrl: "https://api-portal-transparencia.apps.sm.okd4.ciasc.sc.gov.br/api",
  monthsByYear: {
    2021: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    2022: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    2023: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    2024: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    2025: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    2026: [1, 2],
  },
  agrupamentos: ["ano", "mes", "elemento", "subelemento", "unidadegestora"],
  indicador: 0,
};

function periodKey(year, month) {
  return `${year}${String(month).padStart(2, "0")}`;
}

function buildExportUrl(year, month) {
  const url = new URL(`${official.apiUrl}/despesa/exportcsv`);
  const value = periodKey(year, month);

  url.searchParams.append("anomesinifiltro[]", value);
  url.searchParams.append("anomesfimfiltro[]", value);

  official.agrupamentos.forEach((group) => {
    url.searchParams.append("agrupamentos[]", group);
  });

  url.searchParams.set("indicador", String(official.indicador));
  return url.toString();
}

function parseBrazilianNumber(value) {
  const normalized = String(value || "0")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeHeader(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function splitCsvLine(line) {
  if (typeof line !== "string") return [];

  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ";" && !inQuotes) {
      result.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current);
  return result.map((item) => item.trim());
}

function mapHeader(header) {
  const index = {};
  header.forEach((column, idx) => {
    index[normalizeHeader(column)] = idx;
  });
  return index;
}

function getCell(row, idx, columnName) {
  const position = idx[normalizeHeader(columnName)];
  return position === undefined ? "" : row[position] || "";
}

function decodeCsv(buffer) {
  const utf8 = buffer.toString("utf-8");
  if (!utf8.includes("\uFFFD")) return utf8;
  return buffer.toString("latin1");
}

function parseCsvToRecords(text, accumulator) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return;

  const header = splitCsvLine(lines[0]);
  const idx = mapHeader(header);

  lines.slice(1).forEach((line) => {
    const row = splitCsvLine(line);

    const year = Number(getCell(row, idx, "nuano"));
    const month = Number(getCell(row, idx, "numes"));
    const monthLabel = getCell(row, idx, "nmmes").trim();
    const elementoCode = getCell(row, idx, "cdelemento").trim();
    const elementoName = getCell(row, idx, "nmelemento").trim();
    const subelementoCode = getCell(row, idx, "cdsubelemento").trim();
    const subelementoName = getCell(row, idx, "nmsubelemento").trim();
    const unidadeCode = getCell(row, idx, "cdunidadegestora").trim() || "00000";
    const unidadeName = getCell(row, idx, "nmunidadegestora").trim() || "Nao Informado";

    if (!year || !month || !subelementoCode) return;

    const recordKey = [
      year,
      String(month).padStart(2, "0"),
      elementoCode,
      elementoName,
      subelementoCode,
      subelementoName,
      unidadeCode,
      unidadeName,
    ].join("|");

    const current =
      accumulator.get(recordKey) ||
      {
        year,
        month,
        monthLabel,
        periodKey: `${year}-${String(month).padStart(2, "0")}`,
        elementoCode,
        elementoName,
        elementoLabel: `${elementoCode} - ${elementoName}`.trim(),
        subelementoCode,
        subelementoName,
        subelementoLabel: `${subelementoCode} - ${subelementoName}`.trim(),
        unidadeGestoraCode: unidadeCode,
        unidadeGestoraName: unidadeName,
        unidadeGestoraLabel: `${unidadeCode} - ${unidadeName}`.trim(),
        vlempenhado: 0,
        vlliquidado: 0,
        vlpago: 0,
      };

    current.vlempenhado += parseBrazilianNumber(getCell(row, idx, "vlempenhado"));
    current.vlliquidado += parseBrazilianNumber(getCell(row, idx, "vlliquidado"));
    current.vlpago += parseBrazilianNumber(getCell(row, idx, "vlpago"));

    accumulator.set(recordKey, current);
  });
}

async function fetchWithRetry(url, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
      if (response.status === 404) return null;
      throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      if (attempt === retries - 1) throw error;
      console.log(`Erro ao baixar ${url}, tentando novamente (${attempt + 1}/${retries})...`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  return null;
}

const records = new Map();

for (const [year, months] of Object.entries(official.monthsByYear)) {
  for (const month of months) {
    const url = buildExportUrl(year, month);
    console.log(`Baixando ${url}`);

    const response = await fetchWithRetry(url);
    if (!response) {
      console.log(`Aviso: exportacao oficial nao encontrada para ${year}-${String(month).padStart(2, "0")}.`);
      continue;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const csvText = decodeCsv(buffer);
    parseCsvToRecords(csvText, records);
  }
}

await fs.mkdir(outDir, { recursive: true });

const aggregatedRecords = [...records.values()].sort((a, b) => {
  const periodOrder = a.periodKey.localeCompare(b.periodKey);
  if (periodOrder !== 0) return periodOrder;

  const subelementoOrder = a.subelementoCode.localeCompare(b.subelementoCode);
  if (subelementoOrder !== 0) return subelementoOrder;

  return a.unidadeGestoraCode.localeCompare(b.unidadeGestoraCode);
});

const elementos = new Map();
const subelementos = new Map();
const unidades = new Map();
const periodLabels = {};

aggregatedRecords.forEach((record) => {
  elementos.set(record.elementoCode, {
    code: record.elementoCode,
    name: record.elementoName,
    label: record.elementoLabel,
  });

  subelementos.set(record.subelementoCode, {
    code: record.subelementoCode,
    name: record.subelementoName,
    label: record.subelementoLabel,
    elementoCode: record.elementoCode,
  });

  unidades.set(record.unidadeGestoraCode, {
    code: record.unidadeGestoraCode,
    name: record.unidadeGestoraName,
    label: record.unidadeGestoraLabel,
  });

  periodLabels[record.periodKey] = record.monthLabel;
});

const output = {
  generatedAt: new Date().toISOString(),
  source: "Portal da Transparencia SC - API oficial de Despesa",
  availableYears: [...new Set(aggregatedRecords.map((record) => record.year))].sort((a, b) => a - b),
  periodLabels,
  elementos: [...elementos.values()].sort((a, b) => a.label.localeCompare(b.label)),
  subelementos: [...subelementos.values()].sort((a, b) => a.label.localeCompare(b.label)),
  unidades: [...unidades.values()].sort((a, b) => a.label.localeCompare(b.label)),
  facts: aggregatedRecords.map((record) => [
    record.year,
    record.month,
    record.elementoCode,
    record.subelementoCode,
    record.unidadeGestoraCode,
    record.vlempenhado,
    record.vlliquidado,
    record.vlpago,
  ]),
};

await fs.writeFile(outFile, JSON.stringify(output));
console.log(`Cache gerado em ${outFile} com ${aggregatedRecords.length} registros agregados.`);

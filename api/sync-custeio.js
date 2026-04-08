import fs from "node:fs/promises";
import path from "node:path";

const CACHE_FILE = path.join(process.cwd(), "public", "data", "custeio-oficial.json");
const API_URL = "https://api-portal-transparencia.apps.sm.okd4.ciasc.sc.gov.br/api";
const AGRUPAMENTOS = ["ano", "mes", "elemento", "subelemento", "unidadegestora"];
const SUBELEMENTO_PREFIX = "33";

function json(res, statusCode, body) {
  res.status(statusCode).setHeader("Content-Type", "application/json");
  res.send(JSON.stringify(body));
}

function periodKey(year, month) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function compactPeriodKey(year, month) {
  return `${year}${String(month).padStart(2, "0")}`;
}

function parsePeriodKey(value) {
  const [year, month] = String(value || "").split("-").map(Number);
  return { year, month };
}

function shiftPeriod(value, offset) {
  const { year, month } = parsePeriodKey(value);
  const date = new Date(year, month - 1 + offset, 1);
  return periodKey(date.getFullYear(), date.getMonth() + 1);
}

function comparePeriod(a, b) {
  return a.localeCompare(b);
}

function currentBrazilPeriod() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  });
  const parts = formatter.formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  return `${year}-${month}`;
}

function buildPeriodsToRefresh(latestAvailable) {
  const currentPeriod = currentBrazilPeriod();
  const refreshStart = latestAvailable ? shiftPeriod(latestAvailable, -1) : currentPeriod;
  const periods = [];
  let cursor = comparePeriod(refreshStart, currentPeriod) <= 0 ? refreshStart : currentPeriod;

  while (comparePeriod(cursor, currentPeriod) <= 0) {
    periods.push(cursor);
    cursor = shiftPeriod(cursor, 1);
  }

  return [...new Set(periods)];
}

function buildExportUrl(year, month) {
  const url = new URL(`${API_URL}/despesa/exportcsv`);
  const value = compactPeriodKey(year, month);
  url.searchParams.append("anomesinifiltro[]", value);
  url.searchParams.append("anomesfimfiltro[]", value);
  AGRUPAMENTOS.forEach((group) => url.searchParams.append("agrupamentos[]", group));
  url.searchParams.set("indicador", "0");
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

    if (!year || !month || !subelementoCode || !subelementoCode.startsWith(SUBELEMENTO_PREFIX)) return;

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
        periodKey: periodKey(year, month),
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

async function fetchWithRetry(url, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
      if (response.status === 404) return null;
      throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      if (attempt === retries) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return null;
}

function buildPatch(records, refreshedPeriods, fetchedPeriods, missingPeriods) {
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

  return {
    syncedAt: new Date().toISOString(),
    refreshedPeriods,
    periodLabels,
    elementos: [...elementos.values()],
    subelementos: [...subelementos.values()],
    unidades: [...unidades.values()],
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
    sourceSummary: {
      requestedPeriodsCount: refreshedPeriods.length,
      fetchedPeriodsCount: fetchedPeriods.length,
      missingPeriodsCount: missingPeriods.length,
      latestPeriodAvailable: aggregatedRecords.at(-1)?.periodKey || null,
      latestPeriodLabel: aggregatedRecords.at(-1)?.monthLabel || null,
      recordsAggregated: aggregatedRecords.length,
    },
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "Metodo nao permitido." });
  }

  try {
    const cacheRaw = await fs.readFile(CACHE_FILE, "utf-8");
    const cache = JSON.parse(cacheRaw);
    const latestAvailable = cache?.sourceSummary?.latestPeriodAvailable || null;
    const refreshedPeriods = buildPeriodsToRefresh(latestAvailable);
    const fetchedPeriods = [];
    const missingPeriods = [];
    const records = new Map();

    for (const value of refreshedPeriods) {
      const { year, month } = parsePeriodKey(value);
      const response = await fetchWithRetry(buildExportUrl(year, month));

      if (!response) {
        missingPeriods.push(value);
        continue;
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      parseCsvToRecords(decodeCsv(buffer), records);
      fetchedPeriods.push(value);
    }

    const patch = buildPatch(records, refreshedPeriods, fetchedPeriods, missingPeriods);
    return json(res, 200, { ok: true, cachePatch: patch });
  } catch (error) {
    return json(res, 500, {
      ok: false,
      error: error instanceof Error ? error.message : "Falha ao sincronizar custeio.",
    });
  }
}

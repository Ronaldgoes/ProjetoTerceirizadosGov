import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createInflateRaw } from "node:zlib";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "public", "data");
const outFile = path.join(outDir, "custeio-oficial.json");

const official = {
  baseUrl: "https://arquivos.transparencia.sc.gov.br/transparenciasc/dados-abertos/",
  types: ["despesa", "restos"],
  monthsByYear: {
    2021: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    2022: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    2023: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    2024: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    2025: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    2026: [1, 2],
  },
};

function monthUrl(type, year, month) {
  const m = String(month).padStart(2, "0");
  return `${official.baseUrl}${type}/${year}/${type}_${year}_${m}.zip`;
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

function parseCsvToRecords(text, accumulator) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return;

  const header = splitCsvLine(lines[0]);
  const idx = mapHeader(header);

  // Identify value columns
  const empenhadoCols = header.filter(c => {
    const n = normalizeHeader(c);
    return n.includes("empenhado") || n.includes("empenho");
  });
  const liquidadoCols = header.filter(c => normalizeHeader(c).includes("liquidado"));
  const pagoCols = header.filter(c => normalizeHeader(c).includes("pago"));

  lines.slice(1).forEach((line) => {
    const row = splitCsvLine(line);
    const year = Number(getCell(row, idx, "Ano"));
    const month = Number(getCell(row, idx, "Nro Mês"));
    const monthLabel = getCell(row, idx, "Mês").trim();
    const elementoCode = getCell(row, idx, "Código Elemento").trim();
    const elementoName = getCell(row, idx, "Elemento").trim();
    const subelementoCode = getCell(row, idx, "Código Subelemento").trim();
    const subelementoName = getCell(row, idx, "Subelemento").trim();
    const unidadeCode = getCell(row, idx, "Código Unidade Gestora").trim() || "00000";
    const unidadeName = getCell(row, idx, "Unidade Gestora").trim() || "Não Informado";

    if (!year || !month || !subelementoCode) {
      if (subelementoCode === "33903701") {
        console.log(`PULOU LINHA DO SUB 33903701: ${year}/${month} | UG: ${unidadeCode}`);
      }
      return;
    }

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

    // Sum all matching value columns (Exercise + RP)
    empenhadoCols.forEach(col => { current.vlempenhado += parseBrazilianNumber(getCell(row, idx, col)); });
    liquidadoCols.forEach(col => { current.vlliquidado += parseBrazilianNumber(getCell(row, idx, col)); });
    pagoCols.forEach(col => { current.vlpago += parseBrazilianNumber(getCell(row, idx, col)); });

    accumulator.set(recordKey, current);
  });
}

function readUInt32LE(bytes, offset) {
  return (
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)
  ) >>> 0;
}

function findSignature(bytes, signature, from = bytes.length - signature.length) {
  for (let i = from; i >= 0; i -= 1) {
    if (signature.every((value, index) => bytes[i + index] === value)) {
      return i;
    }
  }

  return -1;
}

async function extractSingleFileFromZip(buffer) {
  const bytes = new Uint8Array(buffer);
  const endOfCentralDir = findSignature(bytes, [0x50, 0x4b, 0x05, 0x06]);

  if (endOfCentralDir === -1) {
    throw new Error("Nao foi possivel localizar o diretorio central do ZIP oficial.");
  }

  const centralDirectoryOffset = readUInt32LE(bytes, endOfCentralDir + 16);
  const centralDirectorySignature = readUInt32LE(bytes, centralDirectoryOffset);

  if (centralDirectorySignature !== 0x02014b50) {
    throw new Error("Estrutura de diretorio central invalida no ZIP oficial.");
  }

  const compressionMethod = bytes[centralDirectoryOffset + 10] | (bytes[centralDirectoryOffset + 11] << 8);
  const compressedSize = readUInt32LE(bytes, centralDirectoryOffset + 20);
  const fileNameLength = bytes[centralDirectoryOffset + 28] | (bytes[centralDirectoryOffset + 29] << 8);
  const extraLength = bytes[centralDirectoryOffset + 30] | (bytes[centralDirectoryOffset + 31] << 8);
  const commentLength = bytes[centralDirectoryOffset + 32] | (bytes[centralDirectoryOffset + 33] << 8);
  const localHeaderOffset = readUInt32LE(bytes, centralDirectoryOffset + 42);

  const localHeaderSignature = readUInt32LE(bytes, localHeaderOffset);
  if (localHeaderSignature !== 0x04034b50) {
    throw new Error("Cabecalho local invalido no ZIP oficial.");
  }

  const localNameLength = bytes[localHeaderOffset + 26] | (bytes[localHeaderOffset + 27] << 8);
  const localExtraLength = bytes[localHeaderOffset + 28] | (bytes[localHeaderOffset + 29] << 8);
  const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
  const dataEnd = dataStart + compressedSize;
  const payload = bytes.slice(dataStart, dataEnd);

  if (compressionMethod === 0) {
    return Buffer.from(payload);
  }

  if (compressionMethod === 8) {
    const chunks = [];
    const source = Readable.from(Buffer.from(payload));
    const inflate = createInflateRaw();
    inflate.on("data", (chunk) => chunks.push(chunk));
    await pipeline(source, inflate);
    return Buffer.concat(chunks);
  }

  throw new Error(`Metodo de compressao nao suportado: ${compressionMethod}`);
}

const records = new Map();

// Helper to download with retries
async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
      if (response.status === 404) return null;
    } catch (err) {
      if (i === retries - 1) throw err;
      console.log(`Erro ao baixar, tentando novamente (${i + 1}/${retries})...`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  return null;
}

for (const [year, months] of Object.entries(official.monthsByYear)) {
  for (const month of months) {
    for (const type of official.types) {
      const url = monthUrl(type, year, month);
      console.log(`Baixando ${url}`);
      const response = await fetchWithRetry(url);
      
      if (!response) {
        console.log(`Aviso: ${url} não encontrado ou falhou.`);
        continue;
      }

      const zipBuffer = await response.arrayBuffer();
      const csvBuffer = await extractSingleFileFromZip(zipBuffer);
      
      // Try UTF-8 first, then Latin1
      let csvText;
      try {
        csvText = csvBuffer.toString("utf-8");
        if (csvText.includes("�")) throw new Error("Messed up encoding");
      } catch {
        csvText = csvBuffer.toString("latin1");
      }
      parseCsvToRecords(csvText, records);
    }
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
  source: "Portal da Transparencia SC - Despesa do Poder Executivo",
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

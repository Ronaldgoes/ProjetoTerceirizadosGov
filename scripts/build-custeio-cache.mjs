import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchIpcaSeries } from "../src/utils/ipcaSeries.js";
import {
  buildAggregatedDataset,
  buildContractsExportUrl,
  buildDetailedFactsFromContracts,
  buildDetailedFactsFromSicopDetail,
  buildDespesaCredorExportUrl,
  buildDespesaExportUrl,
  buildExtratoSicopUrl,
  buildProcurementModeOptions,
  comparePeriod,
  currentBrazilPeriod,
  decodeCsv,
  getContractReferencePeriod,
  parseContractsCsv,
  parseDespesaCredorCsvToRecords,
  parseDespesaCsvToRecords,
  periodEndDate,
  shiftPeriod,
  shouldFetchSicopDetail,
} from "../src/utils/custeioOfficialPortal.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "public", "data");
const outFile = path.join(outDir, "custeio-oficial.json");
const creditorChunkPrefix = "custeio-oficial-creditor-";

const official = {
  monthsByYear: {
    2021: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    2022: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    2023: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    2024: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    2025: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    2026: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  },
  currentPeriod: currentBrazilPeriod(),
  contractsHistoryMonths: 18,
  contractsLookbackMonths: 12,
  detailConcurrency: 6,
};

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

async function mapWithConcurrency(items, concurrency, worker) {
  const results = [];
  let cursor = 0;

  async function consume() {
    while (cursor < items.length) {
      const currentIndex = cursor;
      cursor += 1;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  }

  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, items.length || 1)) }, consume);
  await Promise.all(workers);
  return results;
}

const records = new Map();
const creditorRecords = new Map();
const requestedPeriods = [];
const fetchedPeriods = [];
const missingPeriods = [];

for (const [year, months] of Object.entries(official.monthsByYear)) {
  for (const month of months) {
    const monthPeriodKey = `${year}-${String(month).padStart(2, "0")}`;
    requestedPeriods.push(monthPeriodKey);

    const response = await fetchWithRetry(buildDespesaExportUrl(year, month));
    if (!response) {
      missingPeriods.push(monthPeriodKey);
      continue;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    parseDespesaCsvToRecords(decodeCsv(buffer), records);

    const creditorResponse = await fetchWithRetry(buildDespesaCredorExportUrl(year, month));
    if (creditorResponse) {
      const creditorBuffer = Buffer.from(await creditorResponse.arrayBuffer());
      parseDespesaCredorCsvToRecords(decodeCsv(creditorBuffer), creditorRecords);
    }

    fetchedPeriods.push(monthPeriodKey);
  }
}

const aggregated = buildAggregatedDataset(records);
const latestPeriodAvailable =
  aggregated.aggregatedRecords.at(-1)?.periodKey ||
  [...aggregated.availableYears].sort((a, b) => a - b).at(-1)?.toString() ||
  official.currentPeriod;

const contractsStartDate = `${aggregated.availableYears[0] || new Date().getFullYear()}-01-01`;
const contractsEndDate = periodEndDate(latestPeriodAvailable) || periodEndDate(official.currentPeriod);
let contractRows = [];
let dashboardContractRows = [];
let detailedFacts = [];
let procurementModeOptions = [];
const contractDetailErrors = [];
const fetchedContractDetails = [];
const skippedContractDetails = [];

if (contractsEndDate) {
  console.log(`Baixando contratos oficiais entre ${contractsStartDate} e ${contractsEndDate}`);
  const contractsResponse = await fetchWithRetry(buildContractsExportUrl(contractsStartDate, contractsEndDate));

  if (contractsResponse) {
    const buffer = Buffer.from(await contractsResponse.arrayBuffer());
    contractRows = parseContractsCsv(decodeCsv(buffer));
    procurementModeOptions = buildProcurementModeOptions(contractRows);
    const dashboardThreshold = shiftPeriod(latestPeriodAvailable || official.currentPeriod, -official.contractsHistoryMonths);
    dashboardContractRows = contractRows.filter((row) => {
      const referencePeriod = getContractReferencePeriod(row);
      return referencePeriod ? comparePeriod(referencePeriod, dashboardThreshold) >= 0 : false;
    });
    detailedFacts = buildDetailedFactsFromContracts(dashboardContractRows);

    const rowsForDetail = dashboardContractRows.filter((row) => shouldFetchSicopDetail(row, latestPeriodAvailable, official.contractsLookbackMonths));
    skippedContractDetails.push(...dashboardContractRows.filter((row) => !rowsForDetail.includes(row)).map((row) => row.contractNumber || row.titleNumber));

    const detailFactsBatches = await mapWithConcurrency(rowsForDetail, official.detailConcurrency, async (row) => {
      try {
        const response = await fetchWithRetry(buildExtratoSicopUrl(row.titleNumber), 2);
        if (!response) {
          contractDetailErrors.push({
            contractNumber: row.contractNumber,
            titleNumber: row.titleNumber,
            error: "Extrato SICOP não encontrado.",
          });
          return [];
        }

        const payload = await response.json();
        fetchedContractDetails.push(row.contractNumber || row.titleNumber);
        return buildDetailedFactsFromSicopDetail(row, payload);
      } catch (error) {
        contractDetailErrors.push({
          contractNumber: row.contractNumber,
          titleNumber: row.titleNumber,
          error: error instanceof Error ? error.message : String(error),
        });
        return [];
      }
    });

    detailedFacts = [...detailedFacts, ...detailFactsBatches.flat()].filter(Boolean);
  }
}

await fs.mkdir(outDir, { recursive: true });

const creditorFactsByYear = new Map();

[...creditorRecords.values()].forEach((record) => {
  if (!creditorFactsByYear.has(record.year)) {
    creditorFactsByYear.set(record.year, []);
  }

  creditorFactsByYear.get(record.year).push([
    record.year,
    record.month,
    record.elementoCode,
    record.subelementoCode,
    record.unidadeGestoraCode,
    record.creditorCode,
    record.creditorName,
    record.vlempenhado,
    record.vlliquidado,
    record.vlpago,
  ]);
});

const creditorChunkYears = [...creditorFactsByYear.keys()].sort((a, b) => a - b);

const output = {
  generatedAt: new Date().toISOString(),
  syncedAt: new Date().toISOString(),
  source: "Portal da Transparência SC - API oficial de despesa e contratos",
  sourceSummary: {
    requestedPeriods,
    fetchedPeriods,
    missingPeriods,
    requestedPeriodsCount: requestedPeriods.length,
    fetchedPeriodsCount: fetchedPeriods.length,
    missingPeriodsCount: missingPeriods.length,
    latestPeriodAvailable: aggregated.aggregatedRecords.at(-1)?.periodKey || null,
    latestPeriodLabel: aggregated.aggregatedRecords.at(-1)?.monthLabel || null,
    recordsAggregated: aggregated.aggregatedRecords.length,
  },
  contractsSourceSummary: {
    dateRange: { startDate: contractsStartDate, endDate: contractsEndDate },
    contractsFetched: contractRows.length,
    contractsInDashboard: dashboardContractRows.length,
    detailedFactsCount: detailedFacts.length,
    detailedContractsFetched: fetchedContractDetails.length,
    detailedContractsSkipped: skippedContractDetails.length,
    detailedContractsWithError: contractDetailErrors.length,
  },
  availableYears: aggregated.availableYears,
  periodLabels: aggregated.periodLabels,
  elementos: aggregated.elementos,
  subelementos: aggregated.subelementos,
  unidades: aggregated.unidades,
  facts: aggregated.facts,
  creditorFacts: [],
  creditorChunkYears,
  detailedFacts,
  procurementModeOptions,
};

try {
  const ipcaSeries = await fetchIpcaSeries();
  output.ipcaMonthly = ipcaSeries.monthly;
  output.ipcaAnnual = ipcaSeries.annual;
  output.ipcaSourceSummary = ipcaSeries.sourceSummary;
} catch (error) {
  console.warn(`Aviso: falha ao atualizar IPCA automaticamente: ${error instanceof Error ? error.message : String(error)}`);
}

const existingFiles = await fs.readdir(outDir);
await Promise.all(
  existingFiles
    .filter((fileName) => fileName.startsWith(creditorChunkPrefix) && fileName.endsWith(".json"))
    .map((fileName) => fs.unlink(path.join(outDir, fileName)))
);

await Promise.all(
  creditorChunkYears.map((year) =>
    fs.writeFile(
      path.join(outDir, `${creditorChunkPrefix}${year}.json`),
      JSON.stringify({
        year,
        creditorFacts: creditorFactsByYear.get(year) || [],
      })
    )
  )
);

await fs.writeFile(outFile, JSON.stringify(output));
console.log(
  `Cache gerado em ${outFile} com ${aggregated.aggregatedRecords.length} registros agregados, ${creditorRecords.size} registros por credor em ${creditorChunkYears.length} arquivos, ${contractRows.length} contratos e ${detailedFacts.length} fatos detalhados.`
);

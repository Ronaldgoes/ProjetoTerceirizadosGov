import fs from "node:fs/promises";
import path from "node:path";
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
  parsePeriodKey,
  periodEndDate,
  periodKey,
  shiftPeriod,
  shouldFetchSicopDetail,
} from "../src/utils/custeioOfficialPortal.js";

const CACHE_FILE = path.join(process.cwd(), "public", "data", "custeio-oficial.json");
const DETAIL_CONCURRENCY = 6;
const CONTRACTS_HISTORY_MONTHS = 18;
const CONTRACTS_LOOKBACK_MONTHS = 12;
let activeSyncJob = null;

function json(res, statusCode, body) {
  res.status(statusCode).setHeader("Content-Type", "application/json");
  res.send(JSON.stringify(body));
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

function buildPatch(records, creditorRecords, refreshedPeriods, fetchedPeriods, missingPeriods) {
  const aggregated = buildAggregatedDataset(records);

  return {
    syncedAt: new Date().toISOString(),
    refreshedPeriods,
    periodLabels: aggregated.periodLabels,
    elementos: aggregated.elementos,
    subelementos: aggregated.subelementos,
    unidades: aggregated.unidades,
    facts: aggregated.facts,
    creditorFacts: [...creditorRecords.values()].map((record) => [
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
    ]),
    availableYears: aggregated.availableYears,
    sourceSummary: {
      requestedPeriodsCount: refreshedPeriods.length,
      fetchedPeriodsCount: fetchedPeriods.length,
      missingPeriodsCount: missingPeriods.length,
      latestPeriodAvailable: aggregated.aggregatedRecords.at(-1)?.periodKey || null,
      latestPeriodLabel: aggregated.aggregatedRecords.at(-1)?.monthLabel || null,
      recordsAggregated: aggregated.aggregatedRecords.length,
    },
  };
}

async function buildContractsPatch(cache, latestAvailablePeriod) {
  const currentPeriod = currentBrazilPeriod();
  const endDate = periodEndDate(latestAvailablePeriod || cache?.sourceSummary?.latestPeriodAvailable || currentPeriod);
  const startYear = Array.isArray(cache?.availableYears) && cache.availableYears.length > 0
    ? Math.min(...cache.availableYears)
    : new Date().getFullYear();
  const startDate = `${startYear}-01-01`;

  const contractsResponse = await fetchWithRetry(buildContractsExportUrl(startDate, endDate));
  if (!contractsResponse) {
    return {
      detailedFacts: cache?.detailedFacts || [],
      procurementModeOptions: cache?.procurementModeOptions || [],
      contractsSourceSummary: {
        ...(cache?.contractsSourceSummary || {}),
        lastError: "Exportação oficial de contratos não encontrada.",
      },
    };
  }

  const buffer = Buffer.from(await contractsResponse.arrayBuffer());
  const contractRows = parseContractsCsv(decodeCsv(buffer));
  const procurementModeOptions = buildProcurementModeOptions(contractRows);
  const dashboardThreshold = shiftPeriod(latestAvailablePeriod || currentPeriod, -CONTRACTS_HISTORY_MONTHS);
  const dashboardContractRows = contractRows.filter((row) => {
    const referencePeriod = getContractReferencePeriod(row);
    return referencePeriod ? comparePeriod(referencePeriod, dashboardThreshold) >= 0 : false;
  });
  let detailedFacts = buildDetailedFactsFromContracts(dashboardContractRows);
  const contractDetailErrors = [];
  const fetchedContractDetails = [];

  const detailRows = dashboardContractRows.filter((row) => shouldFetchSicopDetail(row, latestAvailablePeriod, CONTRACTS_LOOKBACK_MONTHS));
  const detailBatches = await mapWithConcurrency(detailRows, DETAIL_CONCURRENCY, async (row) => {
    try {
      const response = await fetchWithRetry(buildExtratoSicopUrl(row.titleNumber), 1);
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

  detailedFacts = [...detailedFacts, ...detailBatches.flat()].filter(Boolean);

  return {
    detailedFacts,
    procurementModeOptions,
    contractsSourceSummary: {
      dateRange: { startDate, endDate },
      contractsFetched: contractRows.length,
      contractsInDashboard: dashboardContractRows.length,
      detailedFactsCount: detailedFacts.length,
      detailedContractsFetched: fetchedContractDetails.length,
      detailedContractsWithError: contractDetailErrors.length,
    },
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "Metodo nao permitido." });
  }

  if (activeSyncJob) {
    return json(res, 200, { ok: true, inProgress: true, cachePatch: null });
  }

  try {
    activeSyncJob = (async () => {
      const cacheRaw = await fs.readFile(CACHE_FILE, "utf-8");
      const cache = JSON.parse(cacheRaw);
      const latestAvailable = cache?.sourceSummary?.latestPeriodAvailable || null;
      const refreshedPeriods = buildPeriodsToRefresh(latestAvailable);
      const fetchedPeriods = [];
      const missingPeriods = [];
      const records = new Map();
      const creditorRecords = new Map();

      for (const value of refreshedPeriods) {
        const { year, month } = parsePeriodKey(value);
        const response = await fetchWithRetry(buildDespesaExportUrl(year, month));

        if (!response) {
          missingPeriods.push(value);
          continue;
        }

        const buffer = Buffer.from(await response.arrayBuffer());
        parseDespesaCsvToRecords(decodeCsv(buffer), records);

        const creditorResponse = await fetchWithRetry(buildDespesaCredorExportUrl(year, month));
        if (creditorResponse) {
          const creditorBuffer = Buffer.from(await creditorResponse.arrayBuffer());
          parseDespesaCredorCsvToRecords(decodeCsv(creditorBuffer), creditorRecords);
        }

        fetchedPeriods.push(value);
      }

      const patch = buildPatch(records, creditorRecords, refreshedPeriods, fetchedPeriods, missingPeriods);
      const latestPatchPeriod = patch?.sourceSummary?.latestPeriodAvailable || latestAvailable || currentBrazilPeriod();

      try {
        const contractsPatch = await buildContractsPatch(cache, latestPatchPeriod);
        patch.detailedFacts = contractsPatch.detailedFacts;
        patch.procurementModeOptions = contractsPatch.procurementModeOptions;
        patch.contractsSourceSummary = contractsPatch.contractsSourceSummary;
      } catch (error) {
        patch.detailedFacts = cache?.detailedFacts || [];
        patch.procurementModeOptions = cache?.procurementModeOptions || [];
        patch.contractsSourceSummary = {
          ...(cache?.contractsSourceSummary || {}),
          lastError: error instanceof Error ? error.message : "Falha ao atualizar contratos oficiais.",
        };
      }

      try {
        const ipcaSeries = await fetchIpcaSeries();
        patch.ipcaMonthly = ipcaSeries.monthly;
        patch.ipcaAnnual = ipcaSeries.annual;
        patch.ipcaSourceSummary = ipcaSeries.sourceSummary;
      } catch (error) {
        patch.ipcaMonthly = cache?.ipcaMonthly || {};
        patch.ipcaAnnual = cache?.ipcaAnnual || {};
        patch.ipcaSourceSummary = {
          ...(cache?.ipcaSourceSummary || {}),
          lastError: error instanceof Error ? error.message : "Falha ao atualizar IPCA automaticamente.",
        };
      }

      return patch;
    })();

    const patch = await activeSyncJob;
    return json(res, 200, { ok: true, cachePatch: patch });
  } catch (error) {
    return json(res, 500, {
      ok: false,
      error: error instanceof Error ? error.message : "Falha ao sincronizar custeio.",
    });
  } finally {
    activeSyncJob = null;
  }
}

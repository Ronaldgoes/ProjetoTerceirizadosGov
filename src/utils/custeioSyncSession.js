const CUSTEIO_SYNC_SESSION_KEY = "custeio-sync-delta-v1";
let activeSyncRequest = null;

function padMonth(value) {
  return String(value).padStart(2, "0");
}

function toPeriodKey(year, month) {
  return `${year}-${padMonth(month)}`;
}

function sortFacts(a, b) {
  const periodOrder = toPeriodKey(a[0], a[1]).localeCompare(toPeriodKey(b[0], b[1]));
  if (periodOrder !== 0) return periodOrder;

  const elementoOrder = String(a[2]).localeCompare(String(b[2]));
  if (elementoOrder !== 0) return elementoOrder;

  const subelementoOrder = String(a[3]).localeCompare(String(b[3]));
  if (subelementoOrder !== 0) return subelementoOrder;

  return String(a[4]).localeCompare(String(b[4]));
}

function mergeDimensionItems(baseItems = [], deltaItems = []) {
  const merged = new Map(baseItems.map((item) => [String(item.code), item]));
  deltaItems.forEach((item) => {
    merged.set(String(item.code), item);
  });
  return [...merged.values()].sort((a, b) => String(a.label || a.code).localeCompare(String(b.label || b.code)));
}

function isValidPatch(patch) {
  return Boolean(patch && Array.isArray(patch.refreshedPeriods) && Array.isArray(patch.facts));
}

export function saveCusteioSyncPatch(patch) {
  if (typeof window === "undefined" || !isValidPatch(patch)) return;
  window.sessionStorage.setItem(CUSTEIO_SYNC_SESSION_KEY, JSON.stringify(patch));
}

export function loadCusteioSyncPatch() {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(CUSTEIO_SYNC_SESSION_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    return isValidPatch(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function clearCusteioSyncPatch() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(CUSTEIO_SYNC_SESSION_KEY);
}

export async function requestCusteioSync(timeoutMs = 12000) {
  if (typeof window === "undefined") {
    return { ok: false, cachePatch: null, skipped: true };
  }

  if (activeSyncRequest) {
    return activeSyncRequest;
  }

  activeSyncRequest = (async () => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch("/api/sync-custeio", {
        method: "POST",
        signal: controller.signal,
      });

      if (!response.ok) {
        return { ok: false, cachePatch: null, status: response.status };
      }

      const result = await response.json();
      const cachePatch = result?.cachePatch ?? null;

      if (cachePatch) {
        saveCusteioSyncPatch(cachePatch);
      }

      return {
        ok: Boolean(result?.ok),
        cachePatch,
        inProgress: Boolean(result?.inProgress),
      };
    } catch (error) {
      return {
        ok: false,
        cachePatch: null,
        aborted: error?.name === "AbortError",
      };
    } finally {
      window.clearTimeout(timeoutId);
      activeSyncRequest = null;
    }
  })();

  return activeSyncRequest;
}

export function mergeCusteioDataset(baseDataset, patch) {
  if (!baseDataset || !isValidPatch(patch)) return baseDataset;

  const refreshedPeriods = new Set(patch.refreshedPeriods);
  const nextFacts = [
    ...(baseDataset.facts || []).filter(([year, month]) => !refreshedPeriods.has(toPeriodKey(year, month))),
    ...patch.facts,
  ].sort(sortFacts);

  const periodLabels = {
    ...(baseDataset.periodLabels || {}),
    ...(patch.periodLabels || {}),
  };

  const latestFact = nextFacts.at(-1);
  const latestPeriodAvailable = latestFact ? toPeriodKey(latestFact[0], latestFact[1]) : baseDataset?.sourceSummary?.latestPeriodAvailable || null;
  const latestPeriodLabel = latestPeriodAvailable ? periodLabels[latestPeriodAvailable] || latestPeriodAvailable : null;
  const availableYears = [...new Set(nextFacts.map(([year]) => year))].sort((a, b) => a - b);

  return {
    ...baseDataset,
    generatedAt: patch.syncedAt || baseDataset.generatedAt,
    syncedAt: patch.syncedAt || baseDataset.syncedAt,
    periodLabels,
    availableYears,
    elementos: mergeDimensionItems(baseDataset.elementos, patch.elementos),
    subelementos: mergeDimensionItems(baseDataset.subelementos, patch.subelementos),
    unidades: mergeDimensionItems(baseDataset.unidades, patch.unidades),
    facts: nextFacts,
    ipcaMonthly: {
      ...(baseDataset.ipcaMonthly || {}),
      ...(patch.ipcaMonthly || {}),
    },
    ipcaAnnual: {
      ...(baseDataset.ipcaAnnual || {}),
      ...(patch.ipcaAnnual || {}),
    },
    ipcaSourceSummary: {
      ...(baseDataset.ipcaSourceSummary || {}),
      ...(patch.ipcaSourceSummary || {}),
    },
    sourceSummary: {
      ...(baseDataset.sourceSummary || {}),
      ...(patch.sourceSummary || {}),
      latestPeriodAvailable,
      latestPeriodLabel,
      recordsAggregated: nextFacts.length,
    },
  };
}

const SIDRA_IPCA_URL = "https://apisidra.ibge.gov.br/values/t/7060/n1/1/v/all";
const IPCA_START_PERIOD = "2021-01";

function compactPeriodKey(periodKey) {
  return String(periodKey || "").replace("-", "");
}

function parseNumber(value) {
  const parsed = Number(String(value || "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

export function currentBrazilPeriodKey() {
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

export function buildIpcaRequestUrl(startPeriod = IPCA_START_PERIOD, endPeriod = currentBrazilPeriodKey()) {
  const url = new URL(`${SIDRA_IPCA_URL}/p/${compactPeriodKey(startPeriod)}-${compactPeriodKey(endPeriod)}`);
  url.searchParams.set("formato", "json");
  return url.toString();
}

export function parseIpcaRows(rows = []) {
  const monthly = {};
  const annual = {};
  const annualPeriods = {};

  rows.forEach((row) => {
    const variableCode = String(row?.D2C || "");
    const rawPeriod = String(row?.D3C || "");
    const value = parseNumber(row?.V);

    if (!rawPeriod || value === null || rawPeriod.length !== 6) return;

    const periodKey = `${rawPeriod.slice(0, 4)}-${rawPeriod.slice(4, 6)}`;
    const year = rawPeriod.slice(0, 4);

    if (variableCode === "63") {
      monthly[periodKey] = value;
    }

    if (variableCode === "69") {
      if (!annualPeriods[year] || periodKey > annualPeriods[year]) {
        annual[year] = value;
        annualPeriods[year] = periodKey;
      }
    }
  });

  const latestMonthlyPeriod = Object.keys(monthly).sort().at(-1) || null;
  const latestAnnualYear = Object.keys(annual).sort().at(-1) || null;

  return {
    monthly,
    annual,
    sourceSummary: {
      source: "SIDRA/IBGE - Tabela 7060",
      seriesStartPeriod: IPCA_START_PERIOD,
      latestMonthlyPeriod,
      latestAnnualYear,
      monthlyPoints: Object.keys(monthly).length,
      annualPoints: Object.keys(annual).length,
      updatedAt: new Date().toISOString(),
    },
  };
}

export async function fetchIpcaSeries(startPeriod = IPCA_START_PERIOD, endPeriod = currentBrazilPeriodKey()) {
  const response = await fetch(buildIpcaRequestUrl(startPeriod, endPeriod));
  if (!response.ok) {
    throw new Error(`Falha ao carregar IPCA do SIDRA: HTTP ${response.status}`);
  }

  const rows = await response.json();
  return parseIpcaRows(Array.isArray(rows) ? rows.slice(1) : []);
}

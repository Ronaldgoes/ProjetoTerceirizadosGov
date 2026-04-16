function toNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function parseComparableDate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const normalized = String(value).trim();
  if (!normalized) return null;

  const directDate = new Date(normalized);
  if (!Number.isNaN(directDate.getTime())) return directDate;

  const brMatch = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (brMatch) {
    const [, day, month, year, hours = "0", minutes = "0", seconds = "0"] = brMatch;
    const parsed = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hours),
      Number(minutes),
      Number(seconds)
    );
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

function buildPeriodKey(fact) {
  if (fact?.periodKey) return String(fact.periodKey);

  const year = Number(fact?.year);
  const month = Number(fact?.month);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month <= 0) return "";

  return `${year}-${String(month).padStart(2, "0")}`;
}

function matchesPeriodFilters(fact, filters = {}) {
  const periodKey = buildPeriodKey(fact);
  const selectedYear = filters.selectedYear;
  const periodStart = filters.periodStart;
  const periodEnd = filters.periodEnd;

  const yearOk = selectedYear === "all" || selectedYear === undefined || Number(fact?.year) === Number(selectedYear);
  const periodStartOk = !periodStart || periodStart === "all" || !periodKey || periodKey >= periodStart;
  const periodEndOk = !periodEnd || periodEnd === "all" || !periodKey || periodKey <= periodEnd;

  return yearOk && periodStartOk && periodEndOk;
}

function buildGroupKey(ugCode, subelementoCode, ugLabel, subelementoLabel) {
  return `${String(ugCode || ugLabel || "").trim()}-${String(subelementoCode || subelementoLabel || "").trim()}`;
}

export function groupByUgSubelemento(facts, filters = {}) {
  const filteredFacts = (Array.isArray(facts) ? facts : []).filter((fact) => matchesPeriodFilters(fact, filters));

  const grouped = new Map();

  filteredFacts.forEach((fact) => {
    const ugCode = String(fact?.unidadeGestoraCode || fact?.ug || "").trim();
    const ugLabel = String(fact?.unidadeGestoraLabel || fact?.ugDescricao || fact?.ugDescription || ugCode).trim();
    const subelementoCode = String(fact?.subelementoCode || fact?.subelemento || "").trim();
    const subelementoLabel = String(
      fact?.subelementoLabel || fact?.subelementoDescricao || fact?.subelementoDescription || subelementoCode
    ).trim();
    const groupKey = buildGroupKey(ugCode, subelementoCode, ugLabel, subelementoLabel);

    if (!groupKey) return;

    const current = grouped.get(groupKey) || {
      key: groupKey,
      ug: ugCode || ugLabel || "UG não informada",
      subelemento: subelementoCode || subelementoLabel || "Subelemento não informado",
      ugDescricao: ugLabel || ugCode || "UG não informada",
      subelementoDescricao: subelementoLabel || subelementoCode || "Subelemento não informado",
      empenhado: 0,
      liquidado: 0,
      pago: 0,
      registros: 0,
      credores: new Map(),
    };

    current.empenhado += toNumber(fact?.vlempenhado);
    current.liquidado += toNumber(fact?.vlliquidado);
    current.pago += toNumber(fact?.vlpago);
    current.registros += 1;

    const creditorLabel = String(fact?.creditorLabel || fact?.creditorName || "").trim();
    if (creditorLabel) {
      const currentCreditor = current.credores.get(creditorLabel) || {
        label: creditorLabel,
        empenhado: 0,
        liquidado: 0,
        pago: 0,
      };

      currentCreditor.empenhado += toNumber(fact?.vlempenhado);
      currentCreditor.liquidado += toNumber(fact?.vlliquidado);
      currentCreditor.pago += toNumber(fact?.vlpago);
      current.credores.set(creditorLabel, currentCreditor);
    }

    grouped.set(groupKey, current);
  });

  return [...grouped.values()]
    .filter((item) => item.empenhado !== 0 || item.liquidado !== 0 || item.pago !== 0)
    .map((item) => ({
      ...item,
      allCredores: [...item.credores.values()]
        .sort((a, b) => {
          if (b.pago !== a.pago) return b.pago - a.pago;
          if (b.liquidado !== a.liquidado) return b.liquidado - a.liquidado;
          return b.empenhado - a.empenhado;
        }),
      credoresCount: item.credores.size,
    }))
    .sort((a, b) => {
      if (b.pago !== a.pago) return b.pago - a.pago;
      if (b.liquidado !== a.liquidado) return b.liquidado - a.liquidado;
      return b.empenhado - a.empenhado;
    });
}

export function getPreLiquidacao(facts) {
  return (Array.isArray(facts) ? facts : [])
    .filter((fact) => {
      const pagamento = fact?.paymentDate ?? fact?.pagamento ?? null;
      const liquidacao = fact?.liquidationDate ?? fact?.liquidacao ?? null;

      if (!pagamento) return false;
      if (!liquidacao) return false;

      const pagamentoDate = parseComparableDate(pagamento);
      const liquidacaoDate = parseComparableDate(liquidacao);

      if (!pagamentoDate || !liquidacaoDate) return false;
      return pagamentoDate.getTime() < liquidacaoDate.getTime();
    })
    .sort((a, b) => toNumber(b?.vlpago || b?.value) - toNumber(a?.vlpago || a?.value));
}

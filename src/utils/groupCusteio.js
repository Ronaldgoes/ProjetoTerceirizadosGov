function toNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
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
    };

    current.empenhado += toNumber(fact?.vlempenhado);
    current.liquidado += toNumber(fact?.vlliquidado);
    current.pago += toNumber(fact?.vlpago);
    current.registros += 1;
    grouped.set(groupKey, current);
  });

  return [...grouped.values()]
    .filter((item) => item.empenhado !== 0 || item.liquidado !== 0 || item.pago !== 0)
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
      if (!liquidacao) return true;

      const pagamentoDate = new Date(pagamento);
      const liquidacaoDate = new Date(liquidacao);

      if (!Number.isNaN(pagamentoDate.getTime()) && !Number.isNaN(liquidacaoDate.getTime())) {
        return liquidacaoDate > pagamentoDate;
      }

      return liquidacao > pagamento;
    })
    .sort((a, b) => toNumber(b?.vlpago || b?.value) - toNumber(a?.vlpago || a?.value));
}

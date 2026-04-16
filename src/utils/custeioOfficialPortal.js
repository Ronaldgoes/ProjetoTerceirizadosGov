export const API_URL = "https://api-portal-transparencia.apps.sm.okd4.ciasc.sc.gov.br/api";
export const AGRUPAMENTOS = ["ano", "mes", "elemento", "subelemento", "unidadegestora"];
export const AGRUPAMENTOS_CREDOR = ["ano", "mes", "elemento", "subelemento", "unidadegestora", "credor"];
export const SUBELEMENTO_PREFIX = "33";

export function periodKey(year, month) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function compactPeriodKey(year, month) {
  return `${year}${String(month).padStart(2, "0")}`;
}

export function parsePeriodKey(value) {
  const [year, month] = String(value || "").split("-").map(Number);
  return { year, month };
}

export function comparePeriod(a, b) {
  return String(a || "").localeCompare(String(b || ""));
}

export function shiftPeriod(value, offset) {
  const { year, month } = parsePeriodKey(value);
  if (!year || !month) return value;
  const date = new Date(year, month - 1 + offset, 1);
  return periodKey(date.getFullYear(), date.getMonth() + 1);
}

export function currentBrazilPeriod() {
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

export function periodEndDate(period) {
  const { year, month } = parsePeriodKey(period);
  if (!year || !month) return null;
  const date = new Date(Date.UTC(year, month, 0));
  return date.toISOString().slice(0, 10);
}

export function parseBrazilianNumber(value) {
  const normalized = String(value ?? "0")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function normalizeHeader(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

export function splitCsvLine(line) {
  if (typeof line !== "string") return [];

  const result = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
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

export function mapHeader(header) {
  const index = {};
  header.forEach((column, idx) => {
    index[normalizeHeader(column)] = idx;
  });
  return index;
}

export function getCell(row, idx, columnName) {
  const position = idx[normalizeHeader(columnName)];
  return position === undefined ? "" : row[position] || "";
}

export function decodeCsv(buffer) {
  const utf8 = buffer.toString("utf-8");
  if (!utf8.includes("\uFFFD")) return utf8;
  return buffer.toString("latin1");
}

export function buildDespesaExportUrl(year, month) {
  const url = new URL(`${API_URL}/despesa/exportcsv`);
  const value = compactPeriodKey(year, month);
  url.searchParams.append("anomesinifiltro[]", value);
  url.searchParams.append("anomesfimfiltro[]", value);
  AGRUPAMENTOS.forEach((group) => url.searchParams.append("agrupamentos[]", group));
  url.searchParams.set("indicador", "0");
  return url.toString();
}

export function buildDespesaCredorExportUrl(year, month) {
  const url = new URL(`${API_URL}/despesa/exportcsv`);
  const value = compactPeriodKey(year, month);
  url.searchParams.append("anomesinifiltro[]", value);
  url.searchParams.append("anomesfimfiltro[]", value);
  AGRUPAMENTOS_CREDOR.forEach((group) => url.searchParams.append("agrupamentos[]", group));
  url.searchParams.set("indicador", "0");
  return url.toString();
}

export function buildContractsExportUrl(startDate, endDate) {
  const url = new URL(`${API_URL}/contratos/exportcsv`);
  url.searchParams.set("origem", "todos");
  url.searchParams.set("dtiniciofiltro", startDate);
  url.searchParams.set("dtfimfiltro", endDate);
  url.searchParams.set("page", "1");
  return url.toString();
}

export function buildExtratoSicopUrl(nutitulo) {
  const url = new URL(`${API_URL}/contratos/extratosicop`);
  url.searchParams.append("nutitulofiltro[]", String(nutitulo || "").trim());
  return url.toString();
}

export function parseDespesaCsvToRecords(text, accumulator, subelementoPrefix = SUBELEMENTO_PREFIX) {
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

    if (!year || !month || !subelementoCode || !subelementoCode.startsWith(subelementoPrefix)) return;

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

export function parseDespesaCredorCsvToRecords(text, accumulator, subelementoPrefix = SUBELEMENTO_PREFIX) {
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
    const creditorCode = getCell(row, idx, "cdcredor").trim();
    const creditorName = getCell(row, idx, "nmcredor").trim();

    if (!year || !month || !subelementoCode || !subelementoCode.startsWith(subelementoPrefix) || !creditorName) return;

    const recordKey = [
      year,
      String(month).padStart(2, "0"),
      elementoCode,
      elementoName,
      subelementoCode,
      subelementoName,
      unidadeCode,
      unidadeName,
      creditorCode,
      creditorName,
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
        creditorCode,
        creditorName,
        creditorLabel: creditorCode ? `${creditorCode} - ${creditorName}`.trim() : creditorName,
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

export function buildAggregatedDataset(records) {
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
    aggregatedRecords,
    periodLabels,
    elementos: [...elementos.values()].sort((a, b) => a.label.localeCompare(b.label)),
    subelementos: [...subelementos.values()].sort((a, b) => a.label.localeCompare(b.label)),
    unidades: [...unidades.values()].sort((a, b) => a.label.localeCompare(b.label)),
    availableYears: [...new Set(aggregatedRecords.map((record) => record.year))].sort((a, b) => a - b),
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
}

function parseOfficialDate(rawValue) {
  const value = String(rawValue || "").trim();
  if (!value) return { raw: "", isoDate: "", year: null, month: null, periodKey: "" };

  const isoDate = value.slice(0, 10);
  const [year, month] = isoDate.split("-").map(Number);

  return {
    raw: value,
    isoDate,
    year: Number.isFinite(year) ? year : null,
    month: Number.isFinite(month) ? month : null,
    periodKey: year && month ? periodKey(year, month) : "",
  };
}

function pickContractReferenceDate(record) {
  return (
    record.referenceDate ||
    record.contractStartDate ||
    record.signatureDate ||
    record.contractEndDate ||
    record.proposalDate ||
    ""
  );
}

export function getContractReferencePeriod(record) {
  return parseOfficialDate(pickContractReferenceDate(record)).periodKey;
}

function categorizeProcurementMode(label) {
  const normalized = String(label || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  if (normalized.includes("inexig")) return "Inexigibilidade";
  if (normalized.includes("dispensa")) return "Dispensa";
  return label ? "Modalidade de Licitação" : "Não classificado";
}

function buildUgLabel(code, name) {
  if (code && name) return `${code} - ${name}`.trim();
  return String(name || code || "UG não informada").trim();
}

function normalizeContractRow(raw) {
  const reference = parseOfficialDate(
    raw.contractStartDate || raw.signatureDate || raw.contractEndDate || raw.proposalDate
  );
  const totalValue = raw.currentValue || raw.originalValue || 0;
  const procurementCategory = categorizeProcurementMode(raw.procurementMode);
  const classification = raw.assetType || raw.contractType || raw.scopeType || "";

  return {
    id: `contract-${raw.contractNumber || raw.titleNumber || Math.random().toString(36).slice(2)}`,
    year: reference.year,
    month: reference.month,
    periodKey: reference.periodKey,
    unidadeGestoraCode: raw.unidadeGestoraCode,
    unidadeGestoraLabel: buildUgLabel(raw.unidadeGestoraCode, raw.unidadeGestoraName),
    creditorDocument: raw.creditorDocument,
    creditorName: raw.creditorName || "Não informado",
    classification,
    contractObject: raw.contractObject,
    description: raw.summary || raw.contractObject || classification,
    procurementMode: raw.procurementMode,
    procurementCategory,
    dispensaLicitacao: procurementCategory === "Dispensa",
    contractNumber: raw.contractNumber,
    legalInstrument: raw.legalDocumentNumber,
    contractStartDate: raw.contractStartDate || raw.signatureDate,
    contractEndDate: raw.currentEndDate || raw.contractEndDate,
    hasContract: Boolean(raw.contractNumber || raw.legalDocumentNumber),
    isFundSupply: false,
    quantity: 0,
    unitValue: 0,
    value: totalValue,
    totalValue,
    vlempenhado: 0,
    vlliquidado: 0,
    vlpago: 0,
    sourceOrigin: "contratos-exportcsv",
    nutitulo: raw.titleNumber,
  };
}

export function parseContractsCsv(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const header = splitCsvLine(lines[0]);
  const idx = mapHeader(header);

  return lines
    .slice(1)
    .map((line, index) => {
      const row = splitCsvLine(line);
      const unidadeGestoraCode = getCell(row, idx, "cdunidadegestora").trim();
      const unidadeGestoraName = getCell(row, idx, "nmunidadegestora").trim();
      const contractNumber = getCell(row, idx, "nucontrato").trim();
      const titleNumber = getCell(row, idx, "nutitulo").trim();

      if (!unidadeGestoraCode && !contractNumber && !titleNumber) return null;

      return {
        id: `contract-row-${index + 1}`,
        unidadeGestoraCode,
        unidadeGestoraName,
        gestaoCode: getCell(row, idx, "cdgestao").trim(),
        gestaoName: getCell(row, idx, "nmgestao").trim(),
        contractNumber,
        creditorDocument: getCell(row, idx, "idcontratado").trim(),
        creditorName: getCell(row, idx, "contratado").trim(),
        summary: getCell(row, idx, "resumo").trim(),
        contractObject: getCell(row, idx, "objeto").trim(),
        contractStartDate: getCell(row, idx, "dtinicio").trim(),
        contractEndDate: getCell(row, idx, "dtfim").trim(),
        currentEndDate: getCell(row, idx, "dtfimatual").trim(),
        signatureDate: getCell(row, idx, "dtassinatura").trim(),
        situation: getCell(row, idx, "situacao").trim(),
        processNumber: getCell(row, idx, "nuprocesso").trim(),
        originalValue: parseBrazilianNumber(getCell(row, idx, "vloriginal")),
        currentValue: parseBrazilianNumber(getCell(row, idx, "vlatual")),
        procurementMode: getCell(row, idx, "nmmodalidade").trim(),
        assetType: getCell(row, idx, "bempublico").trim() || getCell(row, idx, "nmbempublico").trim(),
        scopeType: getCell(row, idx, "deesptitulo").trim(),
        contractType: getCell(row, idx, "detipocontrato").trim(),
        legalDocumentType: getCell(row, idx, "detipodocumentolegal").trim(),
        legalDocumentNumber: getCell(row, idx, "nudocumentolegal").trim(),
        titleNumber,
        proposalDate: getCell(row, idx, "dataproposta").trim(),
        originalDays: parseBrazilianNumber(getCell(row, idx, "diasoriginais")),
        addedDays: parseBrazilianNumber(getCell(row, idx, "diasaditados")),
        currentDays: parseBrazilianNumber(getCell(row, idx, "diasatuais")),
        referenceDate:
          getCell(row, idx, "dtinicio").trim() ||
          getCell(row, idx, "dtassinatura").trim() ||
          getCell(row, idx, "dtfimatual").trim() ||
          getCell(row, idx, "dtfim").trim(),
      };
    })
    .filter(Boolean);
}

export function buildDetailedFactsFromContracts(contractRows) {
  return contractRows.map(normalizeContractRow);
}

export function buildProcurementModeOptions(contractRows) {
  return [...new Set(contractRows.map((row) => row.procurementMode).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "pt-BR"))
    .map((label) => ({
      value: String(label || "")
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, ""),
      label,
    }));
}

export function shouldFetchSicopDetail(contractRow, latestAvailablePeriod, lookbackMonths = 12) {
  if (!contractRow?.titleNumber) return false;
  const referencePeriod = parseOfficialDate(pickContractReferenceDate(contractRow)).periodKey;
  if (!referencePeriod) return false;
  const threshold = shiftPeriod(latestAvailablePeriod || currentBrazilPeriod(), -Math.abs(lookbackMonths));
  return comparePeriod(referencePeriod, threshold) >= 0;
}

function buildSicopBaseFact(contractRow, contractData, overrides = {}) {
  const contractStartDate =
    overrides.contractStartDate ||
    contractData?.datainicio ||
    contractRow.contractStartDate ||
    contractRow.signatureDate;
  const contractEndDate =
    overrides.contractEndDate ||
    contractData?.dataterminoatual ||
    contractData?.datatermino ||
    contractRow.currentEndDate ||
    contractRow.contractEndDate;
  const reference = parseOfficialDate(
    overrides.referenceDate || contractStartDate || contractRow.referenceDate || contractRow.signatureDate
  );
  const procurementMode = overrides.procurementMode || contractRow.procurementMode;
  const procurementCategory = categorizeProcurementMode(procurementMode);
  const creditorDocument = overrides.creditorDocument || contractData?.nuidentcontratado || contractRow.creditorDocument;
  const creditorName = overrides.creditorName || contractData?.contratado || contractRow.creditorName;
  const description =
    overrides.description ||
    contractData?.objeto ||
    contractRow.summary ||
    contractRow.contractObject ||
    contractRow.scopeType ||
    "";
  const contractObject = overrides.contractObject || contractData?.objeto || contractRow.contractObject;

  return {
    id: overrides.id,
    year: reference.year,
    month: reference.month,
    periodKey: reference.periodKey,
    unidadeGestoraCode: overrides.unidadeGestoraCode || contractData?.cdugcontratante || contractRow.unidadeGestoraCode,
    unidadeGestoraLabel: buildUgLabel(
      overrides.unidadeGestoraCode || contractData?.cdugcontratante || contractRow.unidadeGestoraCode,
      overrides.unidadeGestoraName || contractData?.ugcontratante || contractRow.unidadeGestoraName
    ),
    creditorDocument,
    creditorName,
    classification: overrides.classification || contractData?.deesptitulo || contractRow.scopeType || contractRow.assetType || "",
    contractObject,
    description,
    procurementMode,
    procurementCategory,
    dispensaLicitacao: procurementCategory === "Dispensa",
    contractNumber: overrides.contractNumber || contractData?.contrato || contractRow.contractNumber,
    legalInstrument: overrides.legalInstrument || contractRow.legalDocumentNumber,
    contractStartDate,
    contractEndDate,
    hasContract: true,
    isFundSupply: false,
    quantity: Number(overrides.quantity || 0) || 0,
    unitValue: Number(overrides.unitValue || 0) || 0,
    value: Number(overrides.value || 0) || 0,
    totalValue: Number(overrides.totalValue || overrides.value || 0) || 0,
    vlempenhado: Number(overrides.vlempenhado || 0) || 0,
    vlliquidado: Number(overrides.vlliquidado || 0) || 0,
    vlpago: Number(overrides.vlpago || 0) || 0,
    elementoCode: "",
    elementoLabel: "",
    subelementoCode: overrides.subelementoCode || "",
    subelementoLabel: overrides.subelementoLabel || "",
    empenhoNumber: overrides.empenhoNumber || "",
    ordemBancariaNumber: overrides.ordemBancariaNumber || "",
    paymentDate: overrides.paymentDate || "",
    liquidationDate: overrides.liquidationDate || "",
    sourceOrigin: overrides.sourceOrigin || "contratos-sicop",
    nutitulo: contractRow.titleNumber,
  };
}

export function buildDetailedFactsFromSicopDetail(contractRow, payload) {
  const contractData = payload?.contrato || {};
  const facts = [];

  (payload?.contratoEmpenho || []).forEach((item, index) => {
    const value = Number(item?.vlnotaempenho || 0) || 0;
    facts.push(
      buildSicopBaseFact(contractRow, contractData, {
        id: `sicop-empenho-${contractRow.titleNumber}-${index}`,
        referenceDate: item?.dtreferencia,
        subelementoCode: String(item?.cdsubelemento || "").trim(),
        subelementoLabel: String(item?.cdsubelemento || "").trim(),
        empenhoNumber: String(item?.nunotaempenho || "").trim(),
        value,
        totalValue: value,
        vlempenhado: value,
        sourceOrigin: "contratos-sicop-empenho",
      })
    );
  });

  (payload?.contratoLiquidacao || []).forEach((item, index) => {
    const value = Number(item?.vlbruto || 0) || 0;
    facts.push(
      buildSicopBaseFact(contractRow, contractData, {
        id: `sicop-liquidacao-${contractRow.titleNumber}-${index}`,
        referenceDate: item?.dtreferencia,
        creditorDocument: String(item?.nucredor || "").trim(),
        creditorName: String(item?.nmcredor || "").trim(),
        empenhoNumber: String(item?.nunotaempenhooriginal || "").trim(),
        liquidationDate: item?.dtreferencia || "",
        value,
        totalValue: value,
        vlliquidado: value,
        sourceOrigin: "contratos-sicop-liquidacao",
      })
    );
  });

  (payload?.contratoPagamento || []).forEach((item, index) => {
    const value = Number(item?.valor || 0) || 0;
    facts.push(
      buildSicopBaseFact(contractRow, contractData, {
        id: `sicop-pagamento-${contractRow.titleNumber}-${index}`,
        referenceDate: item?.dtreferencia,
        ordemBancariaNumber: String(item?.nuordembancaria || "").trim(),
        paymentDate: item?.dtreferencia || "",
        description: String(item?.detipopreparacaopagamento || "").trim() || contractData?.objeto,
        value,
        totalValue: value,
        vlpago: value,
        sourceOrigin: "contratos-sicop-pagamento",
      })
    );
  });

  (payload?.contratoObras || []).forEach((item, index) => {
    const quantity = parseBrazilianNumber(item?.dimensao);
    const totalValue = Number(item?.valorobra || 0) || 0;
    facts.push(
      buildSicopBaseFact(contractRow, contractData, {
        id: `sicop-obra-${contractRow.titleNumber}-${index}`,
        referenceDate: contractRow.referenceDate,
        description: String(item?.descricao || "").trim() || contractData?.objeto,
        classification: contractData?.deesptitulo || contractRow.scopeType || contractRow.assetType || "",
        quantity,
        unitValue: quantity > 0 ? totalValue / quantity : 0,
        value: totalValue,
        totalValue,
        sourceOrigin: "contratos-sicop-obras",
      })
    );
  });

  return facts.filter((fact) => fact.totalValue || fact.vlempenhado || fact.vlliquidado || fact.vlpago || fact.description);
}

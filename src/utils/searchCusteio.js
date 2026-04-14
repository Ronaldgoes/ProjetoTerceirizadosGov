import { matchesSearchQuery, normalizeText } from "./textHelpers.js";

const TEXT_SEARCH_FIELDS = [
  "historico",
  "resumoObjetoContrato",
  "objetoContrato",
  "contractObject",
  "description",
  "objeto",
  "resumoObjeto",
];

function getFieldValue(fact, keys) {
  for (const key of keys) {
    const value = fact?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }

  return "";
}

function buildUgSubelementoKey(ugCode, subelementoCode) {
  return `${String(ugCode || "").trim()}-${String(subelementoCode || "").trim()}`;
}

export function searchByText(facts, searchTerm) {
  const normalizedSearch = normalizeText(searchTerm);
  if (!normalizedSearch) return [];

  const uniqueMatches = new Map();

  for (const fact of Array.isArray(facts) ? facts : []) {
    const searchableText = TEXT_SEARCH_FIELDS.map((field) => fact?.[field]).filter(Boolean).join(" ");

    if (!matchesSearchQuery(searchableText, normalizedSearch)) continue;

    const ugCode = getFieldValue(fact, ["unidadeGestoraCode", "ug"]);
    const ugLabel = getFieldValue(fact, ["unidadeGestoraLabel", "ugDescricao", "ugDescription", "ug"]);
    const subelementoCode = getFieldValue(fact, ["subelementoCode", "subelemento"]);
    const subelementoLabel = getFieldValue(fact, [
      "subelementoLabel",
      "subelementoDescricao",
      "subelementoDescription",
      "subelemento",
    ]);
    const key = buildUgSubelementoKey(ugCode || ugLabel, subelementoCode || subelementoLabel);

    if (!key || uniqueMatches.has(key)) continue;

    uniqueMatches.set(key, {
      key,
      ug: ugCode || ugLabel,
      subelemento: subelementoCode || subelementoLabel,
      ugDescricao: ugLabel || ugCode || "UG não informada",
      subelementoDescricao: subelementoLabel || subelementoCode || "Subelemento não informado",
    });
  }

  return [...uniqueMatches.values()];
}

// Normaliza textos para busca, comparacao e geracao de slug.
export function normalizeText(text) {
  return String(text || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ");
}

const SEARCH_STOPWORDS = new Set([
  "a",
  "as",
  "o",
  "os",
  "ao",
  "aos",
  "da",
  "das",
  "de",
  "do",
  "dos",
  "e",
  "em",
  "na",
  "nas",
  "no",
  "nos",
  "para",
  "por",
  "com",
  "sem",
  "um",
  "uma",
  "uns",
  "umas",
  "que",
]);

export function buildSearchTerms(text) {
  return [
    ...new Set(
      normalizeText(text)
        .split(" ")
        .filter((term) => term.length >= 3 && !SEARCH_STOPWORDS.has(term))
    ),
  ];
}

export function matchesSearchQuery(sourceText, query) {
  const normalizedSource = normalizeText(sourceText);
  const normalizedQuery = normalizeText(query);

  if (!normalizedQuery) return true;
  if (!normalizedSource) return false;
  if (normalizedSource.includes(normalizedQuery)) return true;

  const terms = buildSearchTerms(query);
  if (terms.length === 0) return normalizedSource.includes(normalizedQuery);

  const matchedTerms = terms.filter((term) => normalizedSource.includes(term)).length;

  if (terms.length <= 3) return matchedTerms === terms.length;
  if (terms.length <= 6) return matchedTerms >= terms.length - 1;
  return matchedTerms >= Math.max(4, Math.ceil(terms.length * 0.45));
}

// Gera uma chave amigavel para usar na URL.
export function slugifyText(text) {
  return (
    normalizeText(text)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "sem-nome"
  );
}

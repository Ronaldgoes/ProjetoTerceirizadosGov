// Normaliza textos para busca, comparacao e geracao de slug.
export function normalizeText(text) {
  return String(text || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ");
}

// Gera uma chave amigavel para usar na URL.
export function slugifyText(text) {
  return (
    normalizeText(text)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "sem-nome"
  );
}

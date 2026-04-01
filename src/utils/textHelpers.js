// Normaliza textos para busca, comparação e geração de slug.
export function normalizeText(text) {
  return String(text || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ");
}

// Gera uma chave amigável para usar na URL.
export function slugifyText(text) {
  return (
    normalizeText(text)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "sem-nome"
  );
}

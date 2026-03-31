import { slugifyText } from "./textHelpers";

// Identifica se a linha representa o contrato principal.
export function isMainContract(instrumento) {
  return /^contrato\b/i.test(String(instrumento || "").trim());
}

// Separa os documentos em blocos, mantendo termos e apostilamentos presos ao contrato anterior.
export function buildContractGroups(rows) {
  const groups = [];
  const slugCounts = new Map();
  let currentGroup = null;

  rows.forEach((row) => {
    if (isMainContract(row.instrumento)) {
      const baseSlug = slugifyText(row.instrumento);
      const slugCount = (slugCounts.get(baseSlug) || 0) + 1;
      slugCounts.set(baseSlug, slugCount);

      currentGroup = {
        id: `${baseSlug}-${slugCount}`,
        slug: slugCount === 1 ? baseSlug : `${baseSlug}-${slugCount}`,
        titulo: String(row.instrumento).trim(),
        empresa: String(row.empresa || "").trim(),
        documentos: [row],
      };

      groups.push(currentGroup);
      return;
    }

    if (!currentGroup) {
      currentGroup = {
        id: "documentos-avulsos",
        slug: "documentos-avulsos",
        titulo: "Documentos avulsos",
        empresa: "",
        documentos: [],
      };

      groups.push(currentGroup);
    }

    currentGroup.documentos.push(row);
  });

  return groups;
}

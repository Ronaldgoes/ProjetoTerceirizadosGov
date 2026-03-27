import * as XLSX from "xlsx";

/*
  Arquivo: src/utils/formatters.js
  Descrição: funções utilitárias para formatar valores monetários e numéricos, e mapear colunas de planilha.
*/

export const COL = { instrumento: 0, funcoes: 1, valorAnual: 2, processo: 3, dataAssinatura: 4, vigencia: 5, empresa: 6, local: 7, postos: 8 };

export const DEMO = [
  { instrumento: "3° Termo Aditivo / Alteração no Quadro de Distribuição", funcoes: "Digitador / R$ 3.674,86 / 53 Postos\nRecepcionista / 3.614,66 / 1 Posto", valorAnual: "R$ 2.407.859,16", processo: "SSP/1870/2020", dataAssinatura: "01/06/2018", vigencia: "—", empresa: "Ondrepsb", local: "SC", postos: 54 },
  // ... (pode colocar o restante do DEMO aqui)
];

export const fmtBRL = (v) => {
  const n = parseFloat(String(v).replace(/[R$\s.]/g, "").replace(",", "."));
  if (isNaN(n)) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
};

export const fmtNum = (v) => { const n = parseInt(v); return isNaN(n) ? "—" : n.toLocaleString("pt-BR"); };
export const parseValor = (v) => {
  if (v === undefined || v === null || v === "") return 0;
  if (typeof v === "number" && !isNaN(v)) return v;

  let s = String(v).trim().replace(/[R$\s]/g, "");
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  if (hasComma && hasDot) {
    const lastComma = s.lastIndexOf(",");
    const lastDot = s.lastIndexOf(".");
    if (lastComma > lastDot) {
      // formato brasileiro: 1.234.567,89
      s = s.replace(/\./g, "").replace(/,/g, ".");
    } else {
      // formato inglês: 1,234,567.89
      s = s.replace(/,/g, "");
    }
  } else if (hasComma) {
    // assume decimal com vírgula
    s = s.replace(/\./g, "").replace(/,/g, ".");
  } else {
    // no decimal comma
    s = s.replace(/,/g, "");
  }

  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};
export const parsePostos = (v) => { const n = parseInt(v); return isNaN(n) ? 0 : n; };

export const fmtDate = (v) => {
  if (v === undefined || v === null || v === "") return "—";
  if (v instanceof Date) return v.toLocaleDateString("pt-BR");

  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d || !d.y) return String(v);
    return new Date(d.y, d.m - 1, d.d).toLocaleDateString("pt-BR");
  }

  const parsed = new Date(v);
  if (!isNaN(parsed)) return parsed.toLocaleDateString("pt-BR");

  // Se já estiver no formato dd/mm/yyyy ou texto, mantem como texto
  return String(v);
};
import * as XLSX from "xlsx";

/*
  Arquivo: src/utils/formatters.js
  Descrição: funções utilitárias para formatar valores, números, datas e extrair links do Excel.
*/

export const COL = {
  instrumento: 0,
  funcoes: 1,
  valorAnual: 2,
  processo: 3,
  dataAssinatura: 4,
  vigencia: 5,
  empresa: 6,
  local: 7,
  postos: 8,
};

// ==============================
// 💰 FORMATAR VALOR EM REAL (BRL)
// ==============================
export const fmtBRL = (v) => {
  if (v === undefined || v === null) return "—";

  const n = typeof v === "number" ? v : Number(v);

  if (isNaN(n)) return "—";

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(n);
};

// ==============================
// 🔢 FORMATAR NÚMEROS
// ==============================
export const fmtNum = (v) => {
  const n = parseInt(v);
  return isNaN(n) ? "—" : n.toLocaleString("pt-BR");
};

// ==============================
// 💰 CONVERTER VALOR DA PLANILHA
// ==============================
export const parseValor = (v) => {
  if (v === undefined || v === null || v === "") return 0;

  // Se já for número (Excel às vezes manda assim)
  if (typeof v === "number" && !isNaN(v)) return v;

  let s = String(v).trim().replace(/[R$\s]/g, "");

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  if (hasComma && hasDot) {
    const lastComma = s.lastIndexOf(",");
    const lastDot = s.lastIndexOf(".");

    if (lastComma > lastDot) {
      // 🇧🇷 formato brasileiro: 1.234.567,89
      s = s.replace(/\./g, "").replace(/,/g, ".");
    } else {
      // 🇺🇸 formato inglês: 1,234,567.89
      s = s.replace(/,/g, "");
    }
  } else if (hasComma) {
    // decimal com vírgula
    s = s.replace(/\./g, "").replace(/,/g, ".");
  } else {
    // sem vírgula decimal
    s = s.replace(/,/g, "");
  }

  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};

// ==============================
// 🔢 CONVERTER POSTOS
// ==============================
export const parsePostos = (v) => {
  const n = parseInt(v);
  return isNaN(n) ? 0 : n;
};

// ==============================
// 📅 FORMATAR DATA
// ==============================
export const fmtDate = (v) => {
  if (v === undefined || v === null || v === "") return "—";

  if (v instanceof Date) {
    return v.toLocaleDateString("pt-BR");
  }

  // Excel número (serial date)
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d || !d.y) return String(v);

    return new Date(d.y, d.m - 1, d.d).toLocaleDateString("pt-BR");
  }

  const parsed = new Date(v);
  if (!isNaN(parsed)) return parsed.toLocaleDateString("pt-BR");

  return String(v);
};

// ==============================
// 🔗 EXTRAIR LINK DO EXCEL (COMPLETO)
// ==============================
export function extrairLink(ws, rowIndex, colIndex, valorCelula) {
  try {
    const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
    const cell = ws[cellAddress];

    // ✅ 1. Hyperlink real
    if (cell?.l?.Target) {
      return cell.l.Target;
    }

    // ✅ 2. Fórmula HYPERLINK()
    if (cell?.f && cell.f.toLowerCase().includes("hyperlink")) {
      const match = cell.f.match(/"(https?:\/\/[^"]+)"/);
      if (match) return match[1];
    }

    // ✅ 3. Valor da célula com link
    if (cell?.v && typeof cell.v === "string" && cell.v.includes("http")) {
      return cell.v;
    }

    // ✅ 4. Fallback (valor direto da linha)
    if (typeof valorCelula === "string" && valorCelula.includes("http")) {
      return valorCelula;
    }

    return "";
  } catch (e) {
    return "";
  }
}
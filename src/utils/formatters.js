import * as XLSX from "xlsx";

// Índices padrão usados quando a planilha não traz um cabeçalho reconhecível.
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

// Formata qualquer número como moeda brasileira.
export function fmtBRL(value) {
  if (value === undefined || value === null) return "--";

  const numericValue = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(numericValue)) return "--";

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(numericValue);
}

// Formata valores inteiros usados em postos ou contagens.
export function fmtNum(value) {
  const numericValue = parseInt(value, 10);
  return Number.isNaN(numericValue) ? "--" : numericValue.toLocaleString("pt-BR");
}

// Converte valores monetários vindos da planilha em número JavaScript.
export function parseValor(value) {
  if (value === undefined || value === null || value === "") return 0;
  if (typeof value === "number" && !Number.isNaN(value)) return value;

  let sanitized = String(value).trim().replace(/[R$\s]/g, "");
  const hasComma = sanitized.includes(",");
  const hasDot = sanitized.includes(".");

  if (hasComma && hasDot) {
    const lastComma = sanitized.lastIndexOf(",");
    const lastDot = sanitized.lastIndexOf(".");

    sanitized = lastComma > lastDot ? sanitized.replace(/\./g, "").replace(/,/g, ".") : sanitized.replace(/,/g, "");
  } else if (hasComma) {
    sanitized = sanitized.replace(/\./g, "").replace(/,/g, ".");
  } else {
    sanitized = sanitized.replace(/,/g, "");
  }

  const parsedValue = parseFloat(sanitized);
  return Number.isNaN(parsedValue) ? 0 : parsedValue;
}

// Converte a coluna de postos para inteiro simples.
export function parsePostos(value) {
  const numericValue = parseInt(value, 10);
  return Number.isNaN(numericValue) ? 0 : numericValue;
}

// Formata datas vindas da planilha, inclusive quando o Excel manda serial numérico.
export function fmtDate(value) {
  if (value === undefined || value === null || value === "") return "--";

  if (value instanceof Date) {
    return value.toLocaleDateString("pt-BR");
  }

  if (typeof value === "number") {
    const parsedDate = XLSX.SSF.parse_date_code(value);
    if (!parsedDate || !parsedDate.y) return String(value);

    return new Date(parsedDate.y, parsedDate.m - 1, parsedDate.d).toLocaleDateString("pt-BR");
  }

  const browserDate = new Date(value);
  return Number.isNaN(browserDate.getTime()) ? String(value) : browserDate.toLocaleDateString("pt-BR");
}

// Tenta encontrar um link real na célula do Excel, fórmula ou texto bruto.
export function extrairLink(worksheet, rowIndex, colIndex, cellValue) {
  try {
    const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
    const cell = worksheet[cellAddress];

    if (cell?.l?.Target) return cell.l.Target;

    if (cell?.f && cell.f.toLowerCase().includes("hyperlink")) {
      const match = cell.f.match(/"(https?:\/\/[^"]+)"/);
      if (match) return match[1];
    }

    if (cell?.v && typeof cell.v === "string" && cell.v.includes("http")) {
      return cell.v;
    }

    if (typeof cellValue === "string" && cellValue.includes("http")) {
      return cellValue;
    }

    return "";
  } catch {
    return "";
  }
}

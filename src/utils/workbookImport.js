import * as XLSX from "xlsx";
import { COL, extrairLink, parsePostos, parseValor } from "./formatters";
import { normalizeText } from "./textHelpers";

const COLUMN_ALIASES = {
  instrumento: ["instrumento", "instrumento contratual"],
  funcoes: ["funcoes"],
  valorAnual: ["valor anual", "valor"],
  processo: ["processo"],
  dataAssinatura: ["data assinatura"],
  vigencia: ["vigencia"],
  empresa: ["empresa"],
  local: ["local"],
  postos: ["postos"],
  pdf: ["pdf"],
};

// Procura a coluna real da planilha usando o cabeçalho e aliases conhecidos.
function findColumnIndex(header, fieldName) {
  const normalizedName = normalizeText(fieldName);

  for (let index = 0; index < header.length; index += 1) {
    const columnName = normalizeText(header[index]);

    if (COLUMN_ALIASES[fieldName]?.some((alias) => columnName === normalizeText(alias))) {
      return index;
    }

    if (columnName === normalizedName) {
      return index;
    }
  }

  return COL[fieldName];
}

// Mapeia o cabeçalho da planilha para os campos usados no sistema.
function getColumnIndexes(header) {
  return {
    instrumento: findColumnIndex(header, "instrumento"),
    funcoes: findColumnIndex(header, "funcoes"),
    valorAnual: findColumnIndex(header, "valorAnual"),
    processo: findColumnIndex(header, "processo"),
    dataAssinatura: findColumnIndex(header, "dataAssinatura"),
    vigencia: findColumnIndex(header, "vigencia"),
    empresa: findColumnIndex(header, "empresa"),
    local: findColumnIndex(header, "local"),
    postos: findColumnIndex(header, "postos"),
    pdf: findColumnIndex(header, "pdf"),
  };
}

// Converte a primeira aba do Excel em registros padronizados do app.
export async function loadSpreadsheetRecords(fileName) {
  const response = await fetch(`/planilhas/${fileName}`);
  const buffer = await response.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
  const header = rows[0] || [];
  const columnIndexes = getColumnIndexes(header);

  return rows
    .slice(1)
    .filter((row) => row.some((cell) => cell !== ""))
    .map((row, index) => {
      const rowNumber = index + 1;
      const contractPdf = extrairLink(
        worksheet,
        rowNumber,
        columnIndexes.instrumento,
        row[columnIndexes.instrumento]
      );
      const processLink = extrairLink(worksheet, rowNumber, columnIndexes.processo, row[columnIndexes.processo]);

      return {
        instrumento: row[columnIndexes.instrumento] ?? "",
        funcoes: row[columnIndexes.funcoes] ?? "",
        valorAnual: parseValor(row[columnIndexes.valorAnual] ?? ""),
        processo: row[columnIndexes.processo] ?? "",
        processoLink: processLink,
        dataAssinatura: row[columnIndexes.dataAssinatura] ?? "",
        vigencia: row[columnIndexes.vigencia] ?? "",
        empresa: row[columnIndexes.empresa] ?? "",
        local: row[columnIndexes.local] ?? "",
        postos: parsePostos(row[columnIndexes.postos] ?? ""),
        pdf: contractPdf,
      };
    });
}

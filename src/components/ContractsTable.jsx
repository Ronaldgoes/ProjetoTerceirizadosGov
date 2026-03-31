import { Fragment, useState } from "react";
import { fmtBRL, fmtDate, fmtNum } from "../utils/formatters";

// Destaca visualmente as linhas que representam contratos principais.
function renderContractTitle(text) {
  if (!text) return <span>--</span>;

  const trimmed = String(text).trim();
  const firstWord = trimmed.split(/\s+/)[0] || "";

  if (/^contrato$/i.test(firstWord)) {
    return (
      <span>
        <span style={{ color: "#F59E0B", fontWeight: 700 }}>{firstWord}</span>
        {` ${trimmed.slice(firstWord.length).trimStart()}`}
      </span>
    );
  }

  return <span>{trimmed}</span>;
}

// Tabela principal de documentos e contratos.
export default function ContractsTable({ data, emptyMessage = "Nenhum dado importado ou encontrado." }) {
  const [expandedRow, setExpandedRow] = useState(null);

  if (data.length === 0) {
    return <div style={{ padding: 40, textAlign: "center", color: "#475569" }}>{emptyMessage}</div>;
  }

  return (
    <div className="table-wrapper">
      <table className="data-table">
        <thead>
          <tr>
            <th>Instrumento</th>
            <th>Empresa</th>
            <th>Processo</th>
            <th>Assinatura</th>
            <th>Vigência</th>
            <th style={{ textAlign: "right" }}>Postos</th>
            <th style={{ textAlign: "right" }}>Valor Anual</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => (
            <Fragment key={`${String(row.instrumento || "linha")}-${index}`}>
              <tr
                onClick={() => setExpandedRow(expandedRow === index ? null : index)}
                style={{
                  cursor: "pointer",
                  borderBottom: "1px solid #0B1628",
                  borderTop: /^contrato/i.test(String(row.instrumento || "").trim().split(/\s+/)[0])
                    ? "2px dashed #64748B"
                    : index > 0 && row.instrumento !== data[index - 1].instrumento
                      ? "2px solid #334155"
                      : "1px solid #0B1628",
                }}
              >
                <td style={{ padding: "12px 16px" }}>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {row.pdf ? (
                      <a
                        href={row.pdf}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "#38BDF8", textDecoration: "none", fontWeight: "bold" }}
                      >
                        {renderContractTitle(row.instrumento)}
                      </a>
                    ) : (
                      <span style={{ color: "#94A3B8" }}>{renderContractTitle(row.instrumento)}</span>
                    )}
                  </div>
                </td>
                <td style={{ color: "#38BDF8", fontWeight: 600 }}>{String(row.empresa) || "--"}</td>
                <td style={{ padding: "12px 16px", color: "#64748B" }}>{String(row.processo) || "--"}</td>
                <td style={{ color: "#94A3B8", fontWeight: 600 }}>{fmtDate(row.dataAssinatura)}</td>
                <td style={{ color: "#94A3B8", fontWeight: 600 }}>{fmtDate(row.vigencia)}</td>
                <td style={{ textAlign: "right", color: "#10B981", fontWeight: 700 }}>{fmtNum(row.postos)}</td>
                <td style={{ textAlign: "right", color: "#0EA5E9", fontWeight: 700 }}>{fmtBRL(row.valorAnual)}</td>
                <td style={{ textAlign: "center", fontSize: 10 }}>{expandedRow === index ? "▲" : "▼"}</td>
              </tr>
              {expandedRow === index ? (
                <tr>
                  <td colSpan={8} style={{ background: "#071120", padding: "1px" }}>
                    <div style={{ fontSize: 10, color: "#475569", marginBottom: 5 }}>
                      FUNÇÕES / VALOR MENSAL / POSTOS
                    </div>
                    <p style={{ margin: 0, whiteSpace: "pre-line", fontSize: 12 }}>
                      {String(row.funcoes) || "Não informado"}
                    </p>
                  </td>
                </tr>
              ) : null}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

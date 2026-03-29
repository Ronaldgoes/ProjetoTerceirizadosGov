import { useState } from "react";
import { fmtBRL, fmtNum, fmtDate } from "../utils/formatters";

/*
  Arquivo: src/pages/TableView.jsx
  Descrição: Componente que renderiza a tabela com os contratos filtrados e possibilita expandir por linha para ver detalhes de funções.
*/
export default function TableView({ data }) {
    const [expanded, setExpanded] = useState(null);

    const highlightContrato = (text) => {
        if (!text) return <span>—</span>;

        const trimmed = String(text).trim();
        const firstWord = trimmed.split(/\s+/)[0] || "";

        if (/^contrato$/i.test(firstWord)) {
            return (
                <span>
                    <span style={{ color: "#F59E0B", fontWeight: 700 }}>{firstWord}</span>
                    {" " + trimmed.slice(firstWord.length)}
                </span>
            );
        }

        return <span>{trimmed}</span>;
    };

    if (data.length === 0) {
        return <div style={{ padding: 40, textAlign: "center", color: "#475569" }}>Nenhum dado importado ou encontrado.</div>;
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
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    {data.map((r, i) => (
                        <>
                            <tr
                                key={i}
                                onClick={() => setExpanded(expanded === i ? null : i)}
                                style={{
                                  cursor: "pointer",
                                  borderBottom: "1px solid #0B1628",
                                  borderTop: /^contrato/i.test(String(r.instrumento || "").trim().split(/\s+/)[0]) ? "2px dashed #64748B" : (i > 0 && r.instrumento !== data[i - 1].instrumento ? "2px solid #334155" : "1px solid #0B1628")
                                }}
                            >
                                <td style={{ padding: "12px 16px" }}>
                                  <div style={{ display: "flex", flexDirection: "column" }}>
                                    {r.pdf ? (
                                      <a
                                        href={r.pdf}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{ color: "#38BDF8", textDecoration: "none", fontWeight: "bold" }}
                                      >
                                        {highlightContrato(r.instrumento)} 🔗
                                      </a>
                                    ) : (
                                      <span style={{ color: "#94A3B8" }}>{highlightContrato(r.instrumento)}</span>
                                    )}
                                  </div>
                                </td>
                                <td style={{ color: "#38BDF8", fontWeight: 600 }}>{String(r.empresa) || "—"}</td>
                                <td style={{ padding: "12px 16px", color: "#64748B" }}>
                                  <span>{String(r.processo) || "—"}</span>
                                </td>
                                <td style={{ color: "#94A3B8", fontWeight: 600 }}>{fmtDate(r.dataAssinatura)}</td>
                                <td style={{ color: "#94A3B8", fontWeight: 600 }}>{fmtDate(r.vigencia)}</td>
                                <td style={{ textAlign: "right", color: "#10B981", fontWeight: 700 }}>{fmtNum(r.postos)}</td>
                                <td style={{ textAlign: "right", color: "#0EA5E9", fontWeight: 700 }}>{fmtBRL(r.valorAnual)}</td>
                                <td style={{ textAlign: "center", fontSize: 10 }}>{expanded === i ? "▲" : "▼"}</td>
                            </tr>
                            {expanded === i && (
                                <tr key={`exp-${i}`}>
                                    <td colSpan={8} style={{background: "#071120", padding: "1px" }}>
                                        <div style={{ fontSize: 10, color: "#475569", marginBottom: 5 }}>FUNÇÕES / VALOR MENSAL / POSTOS</div>
                                        <p style={{ margin: 0, whiteSpace: "pre-line", fontSize: 12 }}>{String(r.funcoes) || "Não informado"}</p>
                                    </td>
                                </tr>
                            )}
                        </>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
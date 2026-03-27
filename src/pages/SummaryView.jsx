import { useMemo } from "react";
import { fmtBRL, fmtNum, parseValor, parsePostos } from "../utils/formatters";

/*
  Arquivo: src/pages/SummaryView.jsx
  Descrição: Componente de cards agregados por empresa, mostrando contagem de instrumentos, postos e valor anual total.
*/
export default function SummaryView({ data, orgao }) {
  const byEmpresa = useMemo(() => {
    const m = {};
    data.forEach(r => {
      const e = String(r.empresa) || "—";
      if (!m[e]) m[e] = { count: 0, postos: 0, valor: 0 };
      m[e].count++;
      m[e].postos += parsePostos(r.postos);
      // mantém o valor anual da planilha (não acumulado)
      m[e].valor = parseValor(r.valorAnual);
    });
    return m;
  }, [data]);

  return (
    <div>
      <div style={{ marginBottom: 16, padding: "10px 12px", background: "#0E1E2F", borderRadius: 8 }}>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
      {Object.entries(byEmpresa).map(([empresa, s]) => (
        <div key={empresa} className="kpi-card" style={{ borderLeft: "4px solid #0EA5E9" }}>
          <h3 style={{ margin: "0 0 10px", color: "#38BDF8", fontSize: 14, }}>{empresa}</h3>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <div>
              <small style={{ color: "#475569", display: "block", padding: "0px 10px" }}>INSTRUMENTOS</small>
              <span style={{ fontSize: 18, fontWeight: 700 }}>{s.count}</span>
            </div>
            <div>
              <small style={{ color: "#475569", display: "block" }}>POSTOS</small>
              <span style={{ fontSize: 18, fontWeight: 700, color: "#10B981" }}>{fmtNum(s.postos)}</span>
            </div>
          </div>
          <small style={{ color: "#475569", display: "block", padding: "0px 10px" }}>VALOR ANUAL TOTAL</small>
          <span style={{ fontSize: 16, fontWeight: 700, color: "#0EA5E9" }}>{fmtBRL(s.valor)}</span>
        </div>
      ))}
      </div>
    </div>
  );
  
}

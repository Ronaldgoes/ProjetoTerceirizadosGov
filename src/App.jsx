import { useState, useEffect, useMemo } from "react";
import { BrowserRouter, Routes, Route, Navigate, Link, useParams } from "react-router-dom";
import * as XLSX from "xlsx";
import "./styles/Dashboard.css";
import { COL, parseValor, parsePostos, extrairLink } from "./utils/formatters";

import TableView from "./pages/TableView";

const ORGAOS = [
  { id: "detran", nome: "DETRAN - Departamento de Trânsito", arquivo: "detran.xlsx" },
  { id: "sejuri", nome: "SEJURI - Secretaria de Estado de Justiça e Reintegração Social", arquivo: "sejuri.xlsx" },
  { id: "sef", nome: "SEF - Secretaria de Estado da Fazenda", arquivo: "sef.xlsx" },
  { id: "sas", nome: "SAS - Secretaria de Estado da Assistência Social", arquivo: "sas.xlsx" },
  { id: "sed", nome: "SED - Secretaria de Estado de Educação", arquivo: "sed.xlsx" },
  { id: "udesc", nome: "UDESC - Universidade do Estado de Santa Catarina", arquivo: "udesc.xlsx" },
  { id: "scc", nome: "SCC - Secretaria de Estado da Casa Civil", arquivo: "scc.xlsx" },
  { id: "gvg", nome: "GVG - Gabinete do Vice-Governador", arquivo: "gvg.xlsx" },
];

function SelecaoOrgao() {
  return (
    /* Estilo do container de seleção vindo do código 1 */
    <div style={{ padding: "60px 20px", textAlign: "center", backgroundColor: "#060D1A", minHeight: "100vh" }}>
      <h1 style={{ color: "#03407e", marginBottom: "40px" }}>Gestão de Contratos Terceirizados</h1>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px", maxWidth: "1000px", margin: "0 auto" }}>
        {ORGAOS.map(o => (
          <Link key={o.id} to={`/gestao/${o.id}`} style={{ textDecoration: "none" }}>
            <div className="summary-card" style={{ cursor: "pointer", borderLeft: "4px solid #0EA5E9", background: "#0D1F3C", padding: "30px" }}>
              <div style={{ fontSize: "40px" }}>🏢</div>
              <h3 style={{ color: "#38BDF8", marginTop: "15px" }}>{o.nome}</h3>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function DashboardLayout() {
  const { orgaoId } = useParams();
  const [data, setData] = useState([]);
  const [search, setSearch] = useState("");
  const [msg, setMsg] = useState("");

  const orgaoAtual = ORGAOS.find(o => o.id === orgaoId);

  const normalize = (text) =>
    String(text || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/\s+/g, " ");

  const aliases = {
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

  const findIndex = (header, name) => {
    const search = normalize(name);
    for (let i = 0; i < header.length; i++) {
      const h = normalize(header[i]);
      if (aliases[name]?.some(alias => h === normalize(alias))) return i;
      if (h === search) return i;
    }
    return COL[name];
  };

  const getColIdx = (header) => ({
    instrumento: findIndex(header, "instrumento"),
    funcoes: findIndex(header, "funcoes"),
    valorAnual: findIndex(header, "valorAnual"),
    processo: findIndex(header, "processo"),
    dataAssinatura: findIndex(header, "dataAssinatura"),
    vigencia: findIndex(header, "vigencia"),
    empresa: findIndex(header, "empresa"),
    local: findIndex(header, "local"),
    postos: findIndex(header, "postos"),
    pdf: findIndex(header, "pdf"),
  });

  useEffect(() => {
    const carregar = async () => {
      if (!orgaoAtual) return;
      try {
        setMsg("⏳ Carregando...");
        const res = await fetch(`/planilhas/${orgaoAtual.arquivo}`);
        const buffer = await res.arrayBuffer();
        const wb = XLSX.read(buffer, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
        const header = rows[0] || [];
        const colIdx = getColIdx(header);

        const parsed = rows.slice(1).filter(r => r.some(c => c !== "")).map((r, i) => {
          const rowNum = i + 1;
          const linkInstrumento = extrairLink(ws, rowNum, colIdx.instrumento, r[colIdx.instrumento]);
          const linkProcesso = extrairLink(ws, rowNum, colIdx.processo, r[colIdx.processo]);
          return {
            instrumento: r[colIdx.instrumento] ?? "",
            funcoes: r[colIdx.funcoes] ?? "",
            valorAnual: parseValor(r[colIdx.valorAnual] ?? ""),
            processo: r[colIdx.processo] ?? "",
            processoLink: linkProcesso,
            dataAssinatura: r[colIdx.dataAssinatura] ?? "",
            vigencia: r[colIdx.vigencia] ?? "",
            empresa: r[colIdx.empresa] ?? "",
            local: r[colIdx.local] ?? "",
            postos: parsePostos(r[colIdx.postos] ?? ""),
            pdf: linkInstrumento,
          };
        });
        setData(parsed);
        setMsg("");
      } catch {
        setMsg("Erro ao carregar planilha");
      }
    };
    carregar();
  }, [orgaoId]);

  const filtered = useMemo(() => {
    return data.filter(r =>
      Object.values(r).some(v => String(v).toLowerCase().includes(search.toLowerCase()))
    );
  }, [data, search]);

  return (
    <div className="dashboard-container">
      {/* Header com os estilos do código 1 */}
      <header className="header-main" style={{ padding: "15px 32px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
            <Link to="/" style={{ textDecoration: 'none', color: '#38BDF8', fontSize: 20 }}>🏠</Link>
            <div style={{ fontWeight: 700, color: "#E2E8F0" }}>{orgaoAtual?.nome}</div>
        </div>
        <span style={{ color: "#38BDF8", fontSize: "12px" }}>{msg}</span>
      </header>

      {/* Main com os estilos de layout do código 1 */}
      <main style={{ padding: "30px", maxWidth: "1300px", margin: "0 auto" }}>
        <div className="filter-bar" style={{ marginBottom: 16 }}>
          <input
            className="input-search"
            placeholder="🔍 Pesquisar contrato..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ 
                width: "100%", 
                padding: "12px", 
                borderRadius: "8px", 
                background: "#0D1F3C", 
                border: "1px solid #334155", 
                color: "#fff" 
            }}
          />
        </div>

        <Routes>
          <Route path="/" element={<Navigate to="tabela" replace />} />
          <Route path="tabela" element={<TableView data={filtered} />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SelecaoOrgao />} />
        <Route path="/gestao/:orgaoId/*" element={<DashboardLayout />} />
      </Routes>
    </BrowserRouter>
  );
}
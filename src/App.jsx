import { useState, useEffect, useMemo, useRef } from "react";
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation, useParams } from "react-router-dom";
import * as XLSX from "xlsx";
import "./styles/Dashboard.css";
import { COL, fmtBRL, fmtNum, parseValor, parsePostos } from "./utils/formatters";

/*
  Arquivo: src/App.jsx
  Descrição: Container principal do dashboard. Gerencia rotas, seleção de órgão, leitura de planilhas e estado geral.
  Funções principais:
    - SelecaoOrgao: mostra cards de selecao de orgao
    - DashboardLayout: dashboard com tabela + resumo, filtros, menu lateral e lógica de carregamento da planilha
*/

// Importação das páginas
import TableView from "./pages/TableView";

// Configuração dos Órgãos
const ORGAOS = [
  { id: "detran", nome: "DETRAN - Departamento de Trânsito", arquivo: "detran.xlsx" },
  { id: "sejuri", nome: "SEJURI - Secretaria de Estado de Justiça e Reintegração Social", arquivo: "sejuri.xlsx" },
  { id: "sef", nome: "SEF - Secretaria de Estado da Fazenda", arquivo: "sef.xlsx" },
  { id: "sas", nome: "SAS - Secretaria de Estado da Assistência Social", arquivo: "sas.xlsx" },
  { id: "sie", nome: "SIE - Secretaria de Estado da Infraestrutura e Mobilidade", arquivo: "sie.xlsx" },
 


];

// Colunas (Adicionada a coluna 'pdf' na posição 9 da planilha)
const COL_INDEX = { ...COL, pdf: 9 };

// Componente que renderiza a tela inicial com cards de seleção de órgãos.
// Cada card direciona para /gestao/:orgaoId
function SelecaoOrgao() {
  return (
    <div style={{ padding: "60px 20px", textAlign: "center" }}>
      <h1 style={{ color: "#F1F5F9", marginBottom: "40px" }}>Gestão de Contratos Terceirizados</h1>
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

// Componente principal do painel de gestão de um órgão
// - Carrega o arquivo XLSX do órgão
// - Converte o conteúdo em objetos de contrato
// - Filtra com campo de pesquisa
// - Gerencia resumos por órgão (salvar/limpar)
// - Exibe componente TableView + painel de resumo
function DashboardLayout() {
  const { orgaoId } = useParams();
  const [data, setData] = useState([]);
  const [search, setSearch] = useState("");
  const [msg, setMsg] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [resumos, setResumos] = useState({});
  const [resumoInput, setResumoInput] = useState("");
  const location = useLocation();
  const orgaoAtual = ORGAOS.find(o => o.id === orgaoId);

  const normalize = (text) => String(text || "").trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/\s+/g, " ");

  const aliases = {
    instrumento: ["instrumento", "instrumento contratual", "instrumentos"],
    funcoes: ["funcoes", "funcoes/detalhes", "funcoes do contrato"],
    valorAnual: ["valor anual", "valoranual", "valor", "valor total", "valor contratual"],
    processo: ["processo", "nro processo", "numero do processo", "processo sgpe"],
    dataAssinatura: ["data assinatura", "data de assinatura", "assinatura"],
    vigencia: ["vigencia", "data de vigencia", "vigencia do contrato"],
    empresa: ["empresa", "contratada", "nome da empresa"],
    local: ["local", "cidade", "estado"],
    postos: ["postos", "numero de postos", "quantidade de postos"],
    pdf: ["pdf", "link instrumento", "instrumento pdf"],
  };

  const findIndex = (header, name) => {
    const search = normalize(name);
    for (let i = 0; i < header.length; i++) {
      const h = normalize(header[i]);
      if (aliases[name]?.some(alias => h === normalize(alias))) return i;
      if (h === search) return i;
      if (h.replace(/\s/g, "") === search.replace(/\s/g, "")) return i;
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
    pdf: findIndex(header, "pdf") >= 0 ? findIndex(header, "pdf") : COL_INDEX.pdf,
  });

  const processFile = (file) => {
    setMsg("⏳ Carregando contratos...");
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

        const header = rows[0] || [];
        const colIdx = getColIdx(header);

        const parsed = rows.slice(1).filter(r => r.some(c => c !== "")).map((r, i) => {
          const rowNum = i + 1; // primeira linha de conteúdo
          const cellAddr = XLSX.utils.encode_cell({ r: rowNum, c: colIdx.instrumento });
          const cell = ws[cellAddr];
          const linkContrato = cell?.l?.Target || "";

          return {
            instrumento: r[colIdx.instrumento] ?? "",
            pdf: linkContrato,
            funcoes: r[colIdx.funcoes] ?? "",
            valorAnual: parseValor(r[colIdx.valorAnual] ?? ""),
            processo: r[colIdx.processo] ?? "",
            dataAssinatura: r[colIdx.dataAssinatura] ?? "",
            vigencia: r[colIdx.vigencia] ?? "",
            empresa: r[colIdx.empresa] ?? "",
            local: r[colIdx.local] ?? "",
            postos: parsePostos(r[colIdx.postos] ?? ""),
          };
        });

        setData(parsed);
        setMsg("✅ Pronto!");
        setTimeout(() => setMsg(""), 3000);
      } catch (err) {
        setMsg("❌ Erro ao ler a planilha.");
      }
    };
    reader.readAsBinaryString(file);
  };

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
          const cellAddressInstrumento = XLSX.utils.encode_cell({ r: rowNum, c: colIdx.instrumento });
          const cellInstrumento = ws[cellAddressInstrumento];
          const linkInstrumento = cellInstrumento?.l?.Target || "";

          const cellAddressProcesso = XLSX.utils.encode_cell({ r: rowNum, c: colIdx.processo });
          const cellProcesso = ws[cellAddressProcesso];
          const linkProcesso = cellProcesso?.l?.Target || "";

          const item = {
            instrumento: r[colIdx.instrumento] ?? "",
            funcoes: r[colIdx.funcoes] ?? "",
            valorAnual: parseValor(r[colIdx.valorAnual] ?? ""),
            processo: r[colIdx.processo] ?? "",
            processoLink: linkProcesso || "",
            dataAssinatura: r[colIdx.dataAssinatura] ?? "",
            vigencia: r[colIdx.vigencia] ?? "",
            empresa: r[colIdx.empresa] ?? "",
            local: r[colIdx.local] ?? "",
            postos: parsePostos(r[colIdx.postos] ?? ""),
            pdf: linkInstrumento || (colIdx.pdf >= 0 ? r[colIdx.pdf] : "") || ""
          };

          if (String(item.processo).toLowerCase().includes("75") && String(item.processo).toLowerCase().includes("sap") && String(item.processo).toLowerCase().includes("21")) {
            console.log('DEBUG 75/SAP/21', item);
          }

          return item;
        });
        setData(parsed);
        setMsg("");
      } catch (e) { setMsg("⚠️ Erro ao carregar planilha."); }
    };
    carregar();
  }, [orgaoId]);

  const filtered = useMemo(() => {
    return data.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(search.toLowerCase())));
  }, [data, search]);

  const resumoAtual = resumos[orgaoId] || "";

  useEffect(() => {
    setResumoInput(resumoAtual);
  }, [resumoAtual]);

  const salvarResumo = () => {
    if (!orgaoId) return;
    setResumos(prev => ({ ...prev, [orgaoId]: resumoInput }));
    setMsg("✅ Resumo salvo para este órgão");
    setTimeout(() => setMsg(""), 2500);
  };

  const limparResumo = () => {
    if (!orgaoId) return;
    setResumos(prev => {
      const next = { ...prev };
      delete next[orgaoId];
      return next;
    });
    setResumoInput("");
    setMsg("🗑️ Resumo apagado para este órgão");
    setTimeout(() => setMsg(""), 2500);
  };

  return (
    <div className="dashboard-container">
      <header className="header-main" style={{ padding: "15px 32px", position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
          <button
            onClick={() => setMenuOpen(v => !v)}
            style={{ fontSize: 20, cursor: "pointer", border: "none", background: "transparent", color: "#38BDF8" }}
            aria-label="Abrir menu de órgãos"
          >☰</button>
          <div style={{ fontWeight: 700 }}>{orgaoAtual?.nome || "Selecione um órgão"}</div>
        </div>

        {menuOpen && (
          <div style={{ position: "absolute", top: "60px", left: "16px", width: 220, background: "#0D1F3C", border: "1px solid #334155", borderRadius: 8, padding: 10, zIndex: 20 }}>
            <Link to="/" style={{ display: "block", color: "#E2E8F0", marginBottom: 8 }} onClick={() => setMenuOpen(false)}>🏠 Home</Link>
            {ORGAOS.map(o => (
              <Link key={o.id} to={`/gestao/${o.id}`} onClick={() => setMenuOpen(false)} style={{ display: "block", color: "#E2E8F0", marginBottom: 6 }}>
                {o.nome.split(" ")[0]}
              </Link>
            ))}
          </div>
        )}

        <span style={{ color: "#38BDF8", fontSize: "12px", position: "absolute", right: 20, top: 18 }}>{msg}</span>
      </header>

      <main style={{ padding: "30px", maxWidth: "1300px", margin: "0 auto", position: "relative" }}>
        <div className="filter-bar" style={{ marginBottom: 16 }}>
          <input className="input-search" placeholder="🔍 Pesquisar contrato..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1 }} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 20 }}>
          <div>
            <Routes>
              <Route path="/" element={<Navigate to="tabela" replace />} />
              <Route path="tabela" element={<TableView data={filtered} />} />
            </Routes>
          </div>

          <aside style={{ background: "#0B1220", border: "1px solid #334155", borderRadius: 8, padding: 12, maxHeight: "calc(100vh - 180px)", overflowY: "auto" }}>
            <h3 style={{ margin: "0 0 10px", color: "#E2E8F0" }}>Resumo do órgão</h3>
            <p style={{ color: "#94A3B8", margin: "0 0 8px" }}>Órgão: {orgaoAtual?.nome || "Nenhum órgão selecionado"}</p>
            <textarea
              value={resumoInput}
              onChange={e => setResumoInput(e.target.value)}
              placeholder="Escreva um resumo breve, observações ou pontos de atenção para este órgão"
              style={{ width: "100%", minHeight: 120, background: "#0B1220", color: "#E2E8F0", border: "1px solid #334155", borderRadius: 6, padding: 8, resize: "vertical", marginBottom: 10 }}
            />
            <div style={{ display: "flex", gap: "8px", marginBottom: 8 }}>
              <button
                onClick={salvarResumo}
                style={{ flex: 1, background: "#38BDF8", color: "#0B1220", border: "none", borderRadius: 6, padding: "10px 12px", cursor: "pointer", fontWeight: 700 }}
              >
                Salvar resumo
              </button>
              <button
                onClick={limparResumo}
                style={{ flex: 1, background: "#334155", color: "#E2E8F0", border: "none", borderRadius: 6, padding: "10px 12px", cursor: "pointer", fontWeight: 700 }}
              >
                Limpar resumo
              </button>
            </div>
            <div style={{ marginTop: 2, color: "#CBD5E1", fontSize: 13 }}>
              <strong>Resumo salvo</strong>
              {resumoAtual ? (
                <p style={{ margin: "8px 0 0" }}>{resumoAtual}</p>
              ) : (
                <p style={{ margin: "8px 0 0", color: "#94A3B8" }}>Nenhum resumo salvo para este órgão.</p>
              )}
            </div>
          </aside>
        </div>
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
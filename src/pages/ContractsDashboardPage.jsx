import { useEffect, useMemo, useState } from "react";
import { NavLink, Route, Routes, useLocation, useParams } from "react-router-dom";
import ContractsTable from "../components/ContractsTable";
import TopBar from "../components/TopBar";
import { ORGAOS } from "../data/organs";
import { buildContractGroups } from "../utils/contractGroups";
import { normalizeText } from "../utils/textHelpers";
import { loadSpreadsheetRecords } from "../utils/workbookImport";

function ContractListSection({ groups, orgao }) {
  if (!orgao) {
    return <div className="empty-state">Órgão não encontrado para esta rota.</div>;
  }
  if (groups.length === 0) {
    return <div className="empty-state">Nenhum contrato encontrado para {orgao.sigla}.</div>;
  }

  return (
    <section className="contracts-section">
      <div className="section-header">
        <h2>Contratos de {orgao.sigla}</h2>
        <p>Escolha um contrato para ver apenas os documentos vinculados a ele.</p>
      </div>

      <div className="contracts-grid">
        {groups.map((group) => (
          <NavLink key={group.id} to={`/gestao/${orgao.id}/contratos/${group.slug}`} className="contract-card">
            <span className="contract-card-label">Contrato</span>
            <strong className="contract-card-title">{group.titulo}</strong>
            <span className="contract-card-meta">{group.documentos.length} documento(s)</span>
            {group.empresa ? <span className="contract-card-company">{group.empresa}</span> : null}
          </NavLink>
        ))}
      </div>
    </section>
  );
}

function ContractDetailsSection({ groups, orgao, search }) {
  const { contractSlug } = useParams();

  const selectedGroup = useMemo(() => groups.find((group) => group.slug === contractSlug), [groups, contractSlug]);

  const filteredDocuments = useMemo(() => {
    if (!selectedGroup) return [];

    return selectedGroup.documentos.filter((row) =>
      Object.values(row).some((value) => normalizeText(value).includes(normalizeText(search)))
    );
  }, [search, selectedGroup]);

  if (!selectedGroup) {
    return <div className="empty-state">Contrato não encontrado para {orgao.sigla}.</div>;
  }

  return (
    <section className="contracts-section">
      <div className="section-header">
        <span className="section-kicker">{orgao.sigla}</span>
        <h2>{selectedGroup.titulo}</h2>
        <p>Mostrando apenas termos, apostilamentos e demais documentos ligados a este contrato.</p>
      </div>

      <div className="contract-back-row">
        <NavLink to={`/gestao/${orgao.id}/contratos`} className="back-link">
          Ver lista de contratos
        </NavLink>
      </div>

      <ContractsTable data={filteredDocuments} emptyMessage="Nenhum documento encontrado para este contrato." />
    </section>
  );
}

export default function ContractsDashboardPage() {
  const { orgaoId } = useParams();
  const location = useLocation();
  const [records, setRecords] = useState([]);
  const [search, setSearch] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  const currentOrgan = ORGAOS.find((orgao) => orgao.id === orgaoId);

  useEffect(() => {
    async function loadOrganSpreadsheet() {
      if (!currentOrgan) return;

      try {
        setStatusMessage("Carregando...");
        const nextRecords = await loadSpreadsheetRecords(currentOrgan.arquivo);
        setRecords(nextRecords);
        setStatusMessage("");
      } catch {
        setStatusMessage("Erro ao carregar planilha.");
      }
    }

    loadOrganSpreadsheet();
  }, [currentOrgan]);

  const contractGroups = useMemo(() => buildContractGroups(records), [records]);

  const filteredContractGroups = useMemo(() => {
    return contractGroups.filter((group) =>
      normalizeText(`${group.titulo} ${group.empresa}`).includes(normalizeText(search))
    );
  }, [contractGroups, search]);

  const searchPlaceholder = location.pathname.includes("/contratos/")
    ? "Pesquisar documento dentro deste contrato..."
    : location.pathname.endsWith("/contratos")
      ? "Pesquisar contrato..."
      : "Pesquisar em todos os documentos...";

  return (
    <div className="dashboard-container">
      <TopBar title={currentOrgan?.nome}>
        {statusMessage && (
          <span className="header-status" style={{ marginLeft: "12px" }}>
            {statusMessage}
          </span>
        )}
      </TopBar>

      <div className={`menu-overlay${menuOpen ? " is-open" : ""}`} onClick={() => setMenuOpen(false)} />

      <aside
        id="orgao-navigation"
        className={`mobile-menu${menuOpen ? " is-open" : ""}`}
        aria-label="Órgãos disponíveis"
      >
        <div className="mobile-menu-header">
          <div>
            <strong className="mobile-menu-title">Órgãos</strong>
            <p className="mobile-menu-subtitle">Troque o conteúdo sem sair da dashboard.</p>
          </div>
          <button
            type="button"
            className="menu-close-button"
            onClick={() => setMenuOpen(false)}
            aria-label="Fechar menu de órgãos"
          >
            X
          </button>
        </div>

        <div className="orgao-list">
          <NavLink to="/" className="mobile-nav-link orgao-link">
            <span className="orgao-sigla">HOME</span>
          </NavLink>
          <NavLink to="/analise-custeio" className="mobile-nav-link orgao-link">
            <span className="orgao-sigla">BI</span>
          </NavLink>
          {ORGAOS.map((orgao) => (
            <NavLink
              key={orgao.id}
              to={`/gestao/${orgao.id}/contratos`}
              className={({ isActive }) => `mobile-nav-link orgao-link${isActive ? " active" : ""}`}
            >
              <span className="orgao-sigla">{orgao.sigla}</span>
            </NavLink>
          ))}
        </div>

        <div className="mobile-menu-divider" />

        {statusMessage ? <span className="mobile-status">{statusMessage}</span> : null}
      </aside>

      <div className="contracts-top-actions">
        <div className="contracts-top-actions-inner">
          <button
            type="button"
            className={`hamburger-button hamburger-button-inline${menuOpen ? " is-open" : ""}`}
            aria-label={menuOpen ? "Fechar menu de órgãos" : "Abrir menu de órgãos"}
            aria-expanded={menuOpen}
            aria-controls="orgao-navigation"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="hamburger-button-glyph" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <strong>Órgãos</strong>
          </button>
          {statusMessage ? <span className="contracts-toolbar-status">{statusMessage}</span> : null}
        </div>
      </div>

      <main style={{ padding: "24px 30px 30px", maxWidth: "1300px", margin: "0 auto" }}>
        <div className="filter-bar" style={{ marginBottom: 16 }}>
          <input
            className="input-search"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "8px",
              background: "#0D1F3C",
              border: "1px solid #334155",
              color: "#fff",
            }}
          />
        </div>

        <Routes>
          <Route path="/" element={<ContractListSection groups={filteredContractGroups} orgao={currentOrgan} />} />
          <Route path="contratos" element={<ContractListSection groups={filteredContractGroups} orgao={currentOrgan} />} />
          <Route
            path="contratos/:contractSlug"
            element={<ContractDetailsSection groups={contractGroups} orgao={currentOrgan} search={search} />}
          />
        </Routes>
      </main>
    </div>
  );
}

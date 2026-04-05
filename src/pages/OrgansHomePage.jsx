import { Link } from "react-router-dom";
import ThemeToggle from "../components/ThemeToggle";
import { useAuth } from "../hooks/useAuth";
import { ORGAOS } from "../data/organs";

// Home principal com atalhos para órgãos e painel BI.
export default function OrgansHomePage() {
  const { user, logout, isAdmin } = useAuth();
  const featuredOrgans = ORGAOS.slice(0, 4);
  const quickLinks = [
    {
      to: "/gestao/detran/contratos",
      label: "Contratos",
      title: "Entrar na gestão contratual",
      text: "Acesse rapidamente a área operacional por órgão e contrato.",
    },
    {
      to: "/analise-custeio",
      label: "Painel BI",
      title: "Comparar valores e tendências",
      text: "Abra as análises de custeio com filtros, séries e comparações.",
    },
    {
      to: "/monitoramento",
      label: "Monitoramento",
      title: "Acompanhar órgãos e elementos",
      text: "Monitore itens e acompanhe variações com alertas por usuário.",
    },
  ];

  if (isAdmin) {
    quickLinks.push({
      to: "/admin",
      label: "Admin",
      title: "Gerenciar usuários",
      text: "Visualize usuários cadastrados e promova novos administradores.",
    });
  }

  return (
    <div className="landing-page">
      <div className="landing-shell">
        <header className="landing-header landing-header--clean">
          <div className="landing-brand landing-brand--clean">
            <ThemeToggle />
            <div className="landing-brand-copy">
              <span className="landing-badge">Painel Gov</span>
              <strong>Gestão de Contratos Terceirizados</strong>
            </div>
          </div>
          <nav className="landing-toplinks landing-toplinks--clean" aria-label="Atalhos principais">
            <a href="#acessos">Acessos</a>
            <a href="#orgaos">Órgãos</a>
            <Link to="/analise-custeio">BI</Link>
            {user ? (
              <>
                <Link to="/monitoramento">Monitoramento</Link>
                {isAdmin ? <Link to="/admin">Admin</Link> : null}
                <button type="button" className="landing-auth-link" onClick={logout}>
                  Sair
                </button>
              </>
            ) : (
              <Link to="/login">Entrar</Link>
            )}
          </nav>
        </header>

        <section className="landing-showcase">
          <div className="landing-showcase-main">
            <span className="landing-showcase-kicker">Central principal do sistema</span>
            <h1>Entre no que importa sem ficar navegando demais.</h1>
            <p>
              Abra contratos, BI, monitoramento e administração a partir de uma home mais direta,
              com foco nas ações que você realmente usa no dia a dia.
            </p>

            <div className="landing-showcase-actions">
              <Link to="/gestao/detran/contratos" className="landing-cta-primary">
                Abrir contratos
              </Link>
              <Link to="/analise-custeio" className="landing-cta-secondary">
                Abrir painel BI
              </Link>
              {user ? (
                <Link to="/monitoramento" className="landing-cta-secondary">
                  Monitoramento
                </Link>
              ) : (
                <Link to="/login" className="landing-cta-secondary">
                  Entrar
                </Link>
              )}
            </div>
          </div>

          <aside className="landing-showcase-side">
            <div className="landing-summary-card">
              <span className="landing-summary-label">Sessão</span>
              <strong>{user ? "Acesso ativo" : "Visitante"}</strong>
              <p>{user ? user.email : "Entre para acessar monitoramento, contratos e BI."}</p>
            </div>
            <div className="landing-summary-grid">
              <div className="landing-summary-metric">
                <strong>{ORGAOS.length}</strong>
                <span>órgãos</span>
              </div>
              <div className="landing-summary-metric">
                <strong>BI</strong>
                <span>análise oficial</span>
              </div>
              <div className="landing-summary-metric">
                <strong>Alertas</strong>
                <span>monitoramento</span>
              </div>
              <div className="landing-summary-metric">
                <strong>{isAdmin ? "Admin" : "Painel"}</strong>
                <span>{isAdmin ? "gestão liberada" : "uso operacional"}</span>
              </div>
            </div>
          </aside>
        </section>

        <section id="acessos" className="landing-access-grid">
          {quickLinks.map((item) => (
            <Link key={item.to} to={item.to} className="landing-access-card">
              <span>{item.label}</span>
              <strong>{item.title}</strong>
              <small>{item.text}</small>
            </Link>
          ))}
        </section>

        <section className="landing-inline-section">
          <div className="section-header section-header--compact">
            <span className="section-kicker">Acessos rápidos</span>
            <h2>Órgãos mais usados</h2>
          </div>

          <div className="landing-inline-grid">
            {featuredOrgans.map((orgao) => (
              <Link key={orgao.id} to={`/gestao/${orgao.id}/contratos`} className="landing-inline-card">
                <span className="landing-orgao-sigla">{orgao.sigla}</span>
                <strong>{orgao.nome}</strong>
              </Link>
            ))}
          </div>
        </section>

        <section id="orgaos" className="landing-organs">
          <div className="section-header">
            <span className="section-kicker">Todos os órgãos</span>
            <h2>Escolha o órgão e entre na área contratual</h2>
            <p>Todos os cards abaixo levam direto para a visão de contratos do órgão selecionado.</p>
          </div>

          <div className="landing-organs-grid">
            {ORGAOS.map((orgao) => (
              <Link key={orgao.id} to={`/gestao/${orgao.id}/contratos`} className="landing-orgao-card">
                <span className="landing-orgao-sigla">{orgao.sigla}</span>
                <strong>{orgao.nome}</strong>
                <span className="landing-orgao-link">Acessar contratos</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

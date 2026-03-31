import { Link } from "react-router-dom";
import { ORGAOS } from "../data/organs";

// Home principal com atalhos para orgaos e painel BI.
export default function OrgansHomePage() {
  const featuredOrgans = ORGAOS.slice(0, 4);

  return (
    <div className="landing-page">
      <div className="landing-shell">
        <header className="landing-header">
          <div className="landing-brand">
            <span className="landing-badge">Painel Gov</span>
            <strong>Gestão de Contratos Terceirizados</strong>
          </div>
          <nav className="landing-toplinks" aria-label="Atalhos principais">
            <a href="#acessos">Acessos</a>
            <a href="#orgaos">Órgãos</a>
            <Link to="/analise-custeio">BI</Link>
          </nav>
        </header>

        <section className="hero-section">
          <div className="hero-copy">
            <span className="hero-kicker">Entrada principal do sistema</span>
            <h1>Escolha rápido entre contratos e análise BI.</h1>
            <p>
              A home agora funciona como um ponto de partida mais direto: você entra nos contratos por órgão ou abre
              o painel analítico de custeio sem se perder em navegação desnecessária.
            </p>

            <div className="hero-actions">
              <a href="#acessos" className="hero-primary">Abrir acessos principais</a>
              <Link to="/analise-custeio" className="hero-secondary">
                Entrar no painel BI
              </Link>
              <Link to="/gestao/detran/contratos" className="hero-secondary">
                Ir para contratos
              </Link>
            </div>

            <div className="hero-stats">
              <div className="hero-stat-card">
                <strong>{ORGAOS.length}</strong>
                <span>órgãos monitorados</span>
              </div>
              <div className="hero-stat-card">
                <strong>Fluxo simplificado</strong>
                <span>sem atalhos redundantes</span>
              </div>
              <div className="hero-stat-card">
                <strong>BI oficial</strong>
                <span>dados do portal</span>
              </div>
            </div>
          </div>

          <div className="hero-panel">
            <div className="hero-panel-card">
              <span className="panel-label">Atalhos rápidos</span>
              <div className="landing-quick-actions" id="acessos">
                <Link to="/gestao/detran/contratos" className="landing-quick-card">
                  <span>Contratos</span>
                  <strong>Entrar direto na área contratual</strong>
                  <small>Navegue por órgão e contrato com menu hambúrguer simplificado.</small>
                </Link>
                <Link to="/analise-custeio" className="landing-quick-card is-bi">
                  <span>Painel BI</span>
                  <strong>Abrir análise de custeio</strong>
                  <small>Ranking, séries, filtros e dados oficiais atualizados do portal.</small>
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-feature-strip">
          <article className="feature-card">
            <span>01</span>
            <h3>Home mais direta</h3>
            <p>Entrada focada em decidir rápido entre contratos operacionais e análise BI.</p>
          </article>
          <article className="feature-card">
            <span>02</span>
            <h3>Contratos organizados</h3>
            <p>Termos aditivos e apostilamentos continuam presos ao contrato principal correspondente.</p>
          </article>
          <article className="feature-card">
            <span>03</span>
            <h3>Painel atualizado</h3>
            <p>O BI fica com acesso fácil e leitura mais clara das despesas oficiais do período.</p>
          </article>
        </section>

        <section className="landing-bi-highlight">
          <div className="section-header">
            <span className="section-kicker">Acesso rápido</span>
            <h2>Quatro órgãos mais acessados para entrar sem rolar a tela toda</h2>
            <p>Esses atalhos levam direto para a lista de contratos, sem passos extras.</p>
          </div>

          <div className="landing-quick-grid">
            {featuredOrgans.map((orgao) => (
              <Link key={orgao.id} to={`/gestao/${orgao.id}/contratos`} className="landing-bi-card">
                <span className="landing-orgao-sigla">{orgao.sigla}</span>
                <strong>{orgao.nome}</strong>
                <span className="landing-orgao-link">Abrir contratos</span>
              </Link>
            ))}
          </div>
        </section>

        <section id="orgaos" className="landing-organs">
          <div className="section-header">
            <span className="section-kicker">Todos os órgãos</span>
            <h2>Escolha onde quer entrar</h2>
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

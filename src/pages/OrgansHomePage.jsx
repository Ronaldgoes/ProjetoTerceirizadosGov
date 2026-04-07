import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { ORGAOS } from "../data/organs";

// Home principal com atalhos para órgãos e painel BI.
export default function OrgansHomePage() {
  const { user, profile, logout, isAdmin } = useAuth();
  const featuredOrgans = ORGAOS.slice(0, 4);
  const userName = profile?.name || user?.displayName || "Usuário";

  const quickLinks = [
    {
      to: "/gestao/detran/contratos",
      label: "Contratos",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      ),
      title: "Gestão Contratual",
      text: "Acesse a área operacional por órgão e contrato.",
    },
    {
      to: "/analise-custeio",
      label: "Painel BI",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      ),
      title: "Análise de Custeio",
      text: "Valores, tendências e filtros avançados.",
    },
    {
      to: "/monitoramento",
      label: "Monitoramento",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      ),
      title: "Meus Alertas",
      text: "Monitore variações e receba notificações.",
    },
  ];

  if (isAdmin) {
    quickLinks.push({
      to: "/admin",
      label: "Admin",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="8.5" cy="7" r="4" />
          <polyline points="17 11 19 13 23 9" />
        </svg>
      ),
      title: "Administração",
      text: "Gerenciar usuários e acessos.",
    });
  }

  return (
    <div className="landing-page">
      <div className="landing-shell">
        <header className="landing-header">
          <div className="landing-brand">
            <div className="landing-brand-copy">
              <span className="landing-badge">Painel Gov SC</span>
              <strong>Gestão de Terceirizados</strong>
            </div>
          </div>
          <nav className="landing-toplinks">
            {user ? (
              <div className="user-nav-group">
                <span className="user-welcome">Olá, <strong>{userName}</strong></span>
                <button type="button" className="landing-auth-link" onClick={logout}>
                  Sair
                </button>
              </div>
            ) : (
              <Link to="/login" className="landing-auth-link">Entrar</Link>
            )}
          </nav>
        </header>

        <section className="home-hero">
          <div className="home-hero-content">
            <h1>Sua central de gestão simplificada.</h1>
            <p>
              Acesse contratos, análises de custeio e monitoramento em um só lugar,
              com as informações que você precisa para o dia a dia.
            </p>
          </div>
        </section>

        <section className="home-grid">
          {quickLinks.map((link) => (
            <Link key={link.to} to={link.to} className="home-card">
              <div className="home-card-icon">{link.icon}</div>
              <div className="home-card-body">
                <h3>{link.label}</h3>
                <p>{link.text}</p>
              </div>
              <div className="home-card-arrow">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </div>
            </Link>
          ))}
        </section>

        <footer className="home-footer">
          <p>Governo do Estado de Santa Catarina · Secretaria de Estado da Fazenda</p>
        </footer>
      </div>
    </div>
  );
}

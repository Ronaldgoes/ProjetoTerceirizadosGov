import { Link, NavLink } from "react-router-dom";
import NotificationBell from "./NotificationBell";
import ThemeToggle from "./ThemeToggle";
import { useAuth } from "../hooks/useAuth";

export default function TopBar({ title, children }) {
  const { user, profile, logout, isAdmin } = useAuth();
  const userName = profile?.name || user?.displayName || user?.email || "Usuário";

  return (
    <header className="topbar-unified">
      <div className="topbar-left">
        <Link to="/" className="topbar-home-link" title="Ir para o Início">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          <span>Início</span>
        </Link>
        <div className="topbar-divider" />
        <h1 className="topbar-title">{title}</h1>
      </div>

      <div className="topbar-center">
        {children}
      </div>

      <div className="topbar-right">
        <nav className="topbar-nav">
          <NavLink to="/analise-custeio" className={({ isActive }) => `topbar-nav-link ${isActive ? "active" : ""}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
            <span>Painel BI</span>
          </NavLink>
          <NavLink to="/monitoramento" className={({ isActive }) => `topbar-nav-link ${isActive ? "active" : ""}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <span>Monitoramento</span>
          </NavLink>
          {isAdmin && (
            <NavLink to="/admin" className={({ isActive }) => `topbar-nav-link ${isActive ? "active" : ""}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <polyline points="17 11 19 13 23 9" />
              </svg>
              <span>Admin</span>
            </NavLink>
          )}
        </nav>

        <div className="topbar-divider" />

        <div className="topbar-user">
          <span className="topbar-user-name" title={user?.email}>{userName}</span>
          <div className="topbar-actions">
            <NotificationBell />
            <ThemeToggle />
            <button type="button" className="topbar-logout" onClick={logout} title="Sair do sistema">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import {
  markAlertRead,
  markAllRead,
  useAlertsSnapshot,
} from "../hooks/useAlerts";

function fmt(val) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(val);
}

export default function NotificationBell() {
  const { user }          = useAuth();
  const alerts            = useAlertsSnapshot();
  const [open, setOpen]   = useState(false);
  const panelRef          = useRef(null);

  const unread = alerts.filter((a) => !a.read);

  // Fecha ao clicar fora
  useEffect(() => {
    function handler(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!user) return null;

  return (
    <div className="bell-wrap" ref={panelRef}>
      <button
        type="button"
        className="bell-button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notificações"
        title="Notificações"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread.length > 0 && (
          <span className="bell-badge">{unread.length > 99 ? "99+" : unread.length}</span>
        )}
      </button>

      {open && (
        <div className="bell-panel">
          <div className="bell-panel-header">
            <span>Alertas de Monitoramento</span>
            {unread.length > 0 && (
              <button
                type="button"
                className="bell-mark-all"
                onClick={() => markAllRead(user.uid, alerts)}
              >
                Marcar todos como lidos
              </button>
            )}
          </div>

          {alerts.length === 0 ? (
            <div className="bell-empty">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <path d="M16 6a7 7 0 0 0-7 7c0 7.5-3 10-3 10h20s-3-2.5-3-10a7 7 0 0 0-7-7z" stroke="currentColor" strokeWidth="1.5" />
                <path d="M18.2 26a2.3 2.3 0 0 1-4 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <p>Nenhum alerta ainda.</p>
              <span>Configure itens em <Link to="/monitoramento" onClick={() => setOpen(false)}>Monitoramento</Link></span>
            </div>
          ) : (
            <ul className="bell-list">
              {[...alerts]
                .sort((a, b) => b.createdAt - a.createdAt)
                .map((alert) => (
                  <li key={alert.id} className={`bell-item ${alert.read ? "is-read" : ""}`}>
                    <div className="bell-item-top">
                      <span
                        className={`bell-change ${alert.change >= 0 ? "is-up" : "is-down"}`}
                      >
                        {alert.change >= 0 ? "▲" : "▼"} {Math.abs(alert.change)}%
                      </span>
                      <span className="bell-period">{alert.period}</span>
                      {!alert.read && (
                        <button
                          type="button"
                          className="bell-read-btn"
                          onClick={() => markAlertRead(user.uid, alerts, alert.id)}
                          title="Marcar como lido"
                        >
                          ✓
                        </button>
                      )}
                    </div>
                    <div className="bell-item-label">{alert.label}</div>
                    <div className="bell-item-detail">
                      <span className="bell-metric">{alert.metric}</span>
                      {fmt(alert.from)} → {fmt(alert.to)}
                    </div>
                    <div className="bell-item-footer">
                      <Link
                        to="/analise-custeio"
                        className="bell-view-link"
                        onClick={() => setOpen(false)}
                      >
                        Ver no Painel BI →
                      </Link>
                      <Link
                        to="/monitoramento"
                        className="bell-config-link"
                        onClick={() => setOpen(false)}
                      >
                        Configurar
                      </Link>
                    </div>
                  </li>
                ))}
            </ul>
          )}

          <div className="bell-panel-footer">
            <Link to="/monitoramento" onClick={() => setOpen(false)}>
              Gerenciar monitoramento →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

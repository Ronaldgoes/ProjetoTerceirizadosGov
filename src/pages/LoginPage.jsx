import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import ThemeToggle from "../components/ThemeToggle";
import "../styles/Auth.css";

const DOMAIN = "@sef.sc.gov.br";

export default function LoginPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/";

  const [tab, setTab]         = useState("register"); // "login" | "register"
  const [name, setName]       = useState("");
  const [email, setEmail]     = useState("");
  const [password, setPass]   = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);

  const emailValid = email.endsWith(DOMAIN);
  const emailDirty = email.length > 0;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!emailValid) {
      setError(`Apenas e-mails ${DOMAIN} têm acesso ao sistema.`);
      return;
    }

    if (tab === "register") {
      if (!name.trim()) { setError("Informe seu nome completo."); return; }
      if (password.length < 6) { setError("A senha deve ter pelo menos 6 caracteres."); return; }
      if (password !== confirm) { setError("As senhas não coincidem."); return; }
    }

    try {
      setLoading(true);
      if (tab === "login") {
        await login(email, password);
      } else {
        await register(name, email, password);
      }
      navigate(from, { replace: true });
    } catch (err) {
      const map = {
        "auth/user-not-found":   "Nenhuma conta encontrada com este e-mail.",
        "auth/wrong-password":   "Senha incorreta. Tente novamente.",
        "auth/email-already-in-use": "Este e-mail já possui uma conta.",
        "auth/too-many-requests":"Muitas tentativas. Aguarde alguns minutos.",
        "auth/invalid-credential": "E-mail ou senha inválidos.",
      };
      setError(map[err.code] || err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-bg-glow auth-bg-glow--1" />
      <div className="auth-bg-glow auth-bg-glow--2" />

      <div className="auth-topbar">
        <div className="auth-brand">
          <span className="auth-brand-dot" />
          <strong>Painel Gov SC</strong>
        </div>
        <ThemeToggle />
      </div>

      <div className="auth-card">
        <div className="auth-card-header">
          <div className="auth-logo">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="10" fill="rgba(37,137,232,0.15)" />
              <path d="M8 16C8 11.58 11.58 8 16 8s8 3.58 8 8-3.58 8-8 8-8-3.58-8-8z" stroke="#2589E8" strokeWidth="1.5" />
              <path d="M13 16h6M16 13v6" stroke="#2589E8" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <h1 className="auth-card-title">
            {tab === "login" ? "Bem-vindo de volta" : "Criar conta"}
          </h1>
          <p className="auth-card-sub">Entre ou crie sua conta para acessar o painel.</p>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${tab === "login" ? "active" : ""}`}
            onClick={() => { setTab("login"); setError(""); }}
          >
            Entrar
          </button>
          <button
            type="button"
            className={`auth-tab ${tab === "register" ? "active" : ""}`}
            onClick={() => { setTab("register"); setError(""); }}
          >
            Criar conta
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {tab === "register" && (
            <div className="auth-field">
              <label htmlFor="auth-name">Nome completo</label>
              <input
                id="auth-name"
                type="text"
                autoComplete="name"
                placeholder="João da Silva"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          )}

          <div className="auth-field">
            <label htmlFor="auth-email">E-mail institucional</label>
            <div className={`auth-input-wrap ${emailDirty ? (emailValid ? "is-valid" : "is-invalid") : ""}`}>
              <input
                id="auth-email"
                type="email"
                autoComplete="email"
                placeholder={`joao.silva${DOMAIN}`}
                value={email}
                onChange={(e) => setEmail(e.target.value.trim())}
                required
              />
              {emailDirty && (
                <span className="auth-input-icon">
                  {emailValid ? (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M3 8l4 4 6-6" stroke="#22B98F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M4 4l8 8M12 4l-8 8" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  )}
                </span>
              )}
            </div>
            {emailDirty && !emailValid && (
              <span className="auth-field-hint">Use seu e-mail {DOMAIN}</span>
            )}
          </div>

          <div className="auth-field">
            <label htmlFor="auth-pass">Senha</label>
            <input
              id="auth-pass"
              type="password"
              autoComplete={tab === "login" ? "current-password" : "new-password"}
              placeholder={tab === "login" ? "••••••••" : "Mínimo 6 caracteres"}
              value={password}
              onChange={(e) => setPass(e.target.value)}
              required
            />
          </div>

          {tab === "register" && (
            <div className="auth-field">
              <label htmlFor="auth-confirm">Confirmar senha</label>
              <input
                id="auth-confirm"
                type="password"
                autoComplete="new-password"
                placeholder="Repita a senha"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>
          )}

          {error && (
            <div className="auth-error" role="alert">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="7" stroke="#EF4444" strokeWidth="1.5" />
                <path d="M8 5v3.5M8 10.5v.5" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              {error}
            </div>
          )}

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? (
              <span className="auth-spinner" />
            ) : tab === "login" ? "Entrar no sistema" : "Criar minha conta"}
          </button>
        </form>

        <p className="auth-footer">
          {tab === "login"
            ? "Ainda não tem acesso?"
            : "Já possui conta?"}
          {" "}
          <button
            type="button"
            className="auth-footer-link"
            onClick={() => { setTab(tab === "login" ? "register" : "login"); setError(""); }}
          >
            {tab === "login" ? "Criar conta" : "Entrar"}
          </button>
        </p>
      </div>

      <p className="auth-legal">
        Governo do Estado de Santa Catarina · Secretaria de Estado da Fazenda
      </p>
    </div>
  );
}

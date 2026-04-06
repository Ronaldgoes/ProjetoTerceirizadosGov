import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../config/firebase";
import { useAuth } from "../hooks/useAuth";
import TopBar from "../components/TopBar";
import "../styles/Auth.css";

function formatDate(value) {
  if (!value) return "Sem data";
  if (typeof value?.toDate === "function") return value.toDate().toLocaleString("pt-BR");
  return new Date(value).toLocaleString("pt-BR");
}

export default function AdminPage() {
  const { user, logout, isAdmin } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingUid, setSavingUid] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const usersQuery = query(collection(db, "users"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(usersQuery, (snapshot) => {
      setUsers(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
      setLoading(false);
    });
    return unsub;
  }, []);

  const filteredUsers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return users;

    return users.filter((item) =>
      [item.name, item.email, item.role]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedSearch))
    );
  }, [search, users]);

  async function toggleAdmin(targetUser) {
    setSavingUid(targetUser.id);
    try {
      await updateDoc(doc(db, "users", targetUser.id), {
        role: targetUser.role === "admin" ? "user" : "admin",
        updatedAt: serverTimestamp(),
        updatedBy: user?.email || "",
      });
    } finally {
      setSavingUid("");
    }
  }

  return (
    <div className="monitoring-page">
      <div className="auth-bg-glow auth-bg-glow--1" style={{ opacity: 0.35 }} />

      <TopBar title="Painel Administrativo" />

      <div className="admin-page-shell">
        <section className="admin-summary-grid">
          <article className="admin-summary-card">
            <span>Total de usuarios</span>
            <strong>{users.length}</strong>
          </article>
          <article className="admin-summary-card">
            <span>Administradores</span>
            <strong>{users.filter((item) => item.role === "admin").length}</strong>
          </article>
          <article className="admin-summary-card">
            <span>Seu acesso</span>
            <strong>{isAdmin ? "Administrador" : "Usuario"}</strong>
          </article>
        </section>

        <section className="admin-users-panel">
          <div className="admin-users-header">
            <div>
              <h1>Usuarios cadastrados</h1>
              <p>Visualize quem entrou no sistema e promova outros administradores.</p>
            </div>

            <input
              type="text"
              className="admin-search-input"
              placeholder="Buscar por nome, e-mail ou perfil..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          {loading ? (
            <div className="monitoring-empty">Carregando usuarios...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="monitoring-empty">Nenhum usuario encontrado.</div>
          ) : (
            <div className="admin-users-table">
              <div className="admin-users-row admin-users-row--head">
                <span>Nome</span>
                <span>E-mail</span>
                <span>Perfil</span>
                <span>Criado em</span>
                <span>Acoes</span>
              </div>

              {filteredUsers.map((item) => (
                <div key={item.id} className="admin-users-row">
                  <strong>{item.name || "Sem nome"}</strong>
                  <span>{item.email}</span>
                  <span>
                    <span className={`admin-role-badge admin-role-badge--${item.role || "user"}`}>
                      {item.role === "admin" ? "Administrador" : "Usuario"}
                    </span>
                  </span>
                  <span>{formatDate(item.createdAt)}</span>
                  <span>
                    {item.email === user?.email ? (
                      <span className="admin-self-note">Seu login</span>
                    ) : (
                      <button
                        type="button"
                        className="admin-action-button"
                        disabled={savingUid === item.id}
                        onClick={() => toggleAdmin(item)}
                      >
                        {savingUid === item.id
                          ? "Salvando..."
                          : item.role === "admin"
                            ? "Remover admin"
                            : "Tornar admin"}
                      </button>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

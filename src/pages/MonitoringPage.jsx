import {
  arrayRemove,
  arrayUnion,
  doc,
  onSnapshot,
  setDoc,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import TopBar from "../components/TopBar";
import { useAuth } from "../hooks/useAuth";
import { db } from "../config/firebase";
import "../styles/Auth.css";

const METRICS = [
  { value: "pago",       label: "Pagamento" },
  { value: "liquidado",  label: "Liquidação" },
  { value: "empenhado",  label: "Empenhamento" },
];

const TYPES = [
  { key: "orgao",       label: "Órgão / Unidade Gestora" },
  { key: "elemento",    label: "Elemento de Despesa" },
  { key: "subelemento", label: "Subelemento" },
];

const METRIC_FACT_INDEX = {
  empenhado: 5,
  liquidado: 6,
  pago: 7,
};

function formatCurrency(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function monitorMatchesFact(fact, monitor) {
  if (monitor.type === "orgao") return fact[4] === monitor.code;
  if (monitor.type === "elemento") return fact[2] === monitor.code;
  if (monitor.type === "subelemento") return fact[3] === monitor.code;
  return false;
}

export default function MonitoringPage() {
  const { user, logout } = useAuth();

  const [custeioData, setCusteioData] = useState(null);
  const [monitors, setMonitors]       = useState([]);
  const [activeType, setActiveType]   = useState("orgao");
  const [search, setSearch]           = useState("");
  const [saving, setSaving]           = useState(false);

  const docRef = user ? doc(db, "users", user.uid, "monitors", "list") : null;

  // Carrega custeio-oficial.json
  useEffect(() => {
    fetch("/data/custeio-oficial.json")
      .then((r) => r.json())
      .then(setCusteioData)
      .catch(() => {});
  }, []);

  // Escuta preferências em tempo real do Firestore
  useEffect(() => {
    if (!docRef) return;
    const unsub = onSnapshot(docRef, (snap) => {
      if (snap.exists()) setMonitors(snap.data().items || []);
      else setMonitors([]);
    });
    return unsub;
  }, [docRef]);

  // Monta listas de opções a partir do JSON
  const options = useMemo(() => {
    if (!custeioData) return { orgao: [], elemento: [], subelemento: [] };
    return {
      orgao:       (custeioData.unidades || []).map((u) => ({ code: u.code, label: u.label || u.code })),
      elemento:    (custeioData.elementos || []).map((e) => ({ code: e.code, label: e.label || e.code })),
      subelemento: (custeioData.subelementos || []).map((s) => ({ code: s.code, label: s.label || s.code })),
    };
  }, [custeioData]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return options[activeType].filter(
      (o) => o.label.toLowerCase().includes(q) || o.code.toLowerCase().includes(q)
    );
  }, [options, activeType, search]);

  const monitoredCounts = useMemo(() => {
    const counts = new Map();

    monitors
      .filter((item) => item.type === activeType)
      .forEach((item) => {
        counts.set(item.code, (counts.get(item.code) || 0) + 1);
      });

    return counts;
  }, [monitors, activeType]);

  const currentValuesByMonitor = useMemo(() => {
    const facts = custeioData?.facts || [];
    const nextValues = {};

    monitors.forEach((monitor) => {
      const metricIndex = METRIC_FACT_INDEX[monitor.metric] ?? 7;
      const relevantFacts = facts.filter((fact) => monitorMatchesFact(fact, monitor));

      if (!relevantFacts.length) {
        nextValues[monitor.id] = { value: 0, period: "--" };
        return;
      }

      const latestPeriod = relevantFacts.reduce((latest, fact) => {
        const currentKey = `${fact[0]}-${String(fact[1]).padStart(2, "0")}`;
        if (!latest || currentKey > latest) return currentKey;
        return latest;
      }, "");

      const currentValue = relevantFacts
        .filter((fact) => `${fact[0]}-${String(fact[1]).padStart(2, "0")}` === latestPeriod)
        .reduce((total, fact) => total + Number(fact[metricIndex] || 0), 0);

      nextValues[monitor.id] = {
        value: currentValue,
        period: latestPeriod,
      };
    });

    return nextValues;
  }, [custeioData, monitors]);

  async function addMonitor(item) {
    const newItem = {
      id:        uuidv4(),
      type:      activeType,
      code:      item.code,
      label:     item.label,
      threshold: 15,
      metric:    "pago",
    };
    setSaving(true);
    await setDoc(docRef, { items: arrayUnion(newItem) }, { merge: true });
    setSaving(false);
  }

  async function removeMonitor(mon) {
    setSaving(true);
    await setDoc(docRef, { items: arrayRemove(mon) }, { merge: true });
    setSaving(false);
  }

  async function updateMonitor(mon, field, value) {
    const updated = { ...mon, [field]: value };
    setSaving(true);
    // remove o antigo e insere o atualizado
    await setDoc(
      docRef,
      { items: monitors.map((m) => (m.id === mon.id ? updated : m)) },
      { merge: true }
    );
    setSaving(false);
  }

  return (
    <div className="monitoring-page">
      <div className="auth-bg-glow auth-bg-glow--1" style={{ opacity: 0.4 }} />

      <TopBar title="Monitoramento">
        {saving && <span className="monitoring-saving">Salvando...</span>}
      </TopBar>

      <div className="monitoring-layout">
        {/* Painel esquerdo: busca e lista */}
        <aside className="monitoring-sidebar">
          <div className="monitoring-section-title">Adicionar item ao monitoramento</div>

          {/* Tabs de tipo */}
          <div className="monitoring-type-tabs">
            {TYPES.map((t) => (
              <button
                key={t.key}
                type="button"
                className={`monitoring-type-tab ${activeType === t.key ? "active" : ""}`}
                onClick={() => { setActiveType(t.key); setSearch(""); }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Busca */}
          <div className="monitoring-search-wrap">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M10 10l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              className="monitoring-search"
              placeholder="Buscar por nome ou código..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Lista de opções */}
          <div className="monitoring-options-list">
            {!custeioData && (
              <div className="monitoring-empty">Carregando dados...</div>
            )}
            {custeioData && filtered.length === 0 && (
              <div className="monitoring-empty">Nenhum resultado encontrado.</div>
            )}
            {filtered.slice(0, 80).map((item) => {
              const addedCount = monitoredCounts.get(item.code) || 0;
              return (
                <button
                  key={item.code}
                  type="button"
                  className="monitoring-option"
                  onClick={() => addMonitor(item)}
                >
                  <span className="monitoring-option-code">{item.code}</span>
                  <span className="monitoring-option-label">{item.label}</span>
                  {addedCount > 0 ? (
                    <span className="monitoring-option-badge">{addedCount}x no monitoramento</span>
                  ) : (
                    <span className="monitoring-option-add">+ Adicionar</span>
                  )}
                </button>
              );
            })}
          </div>
        </aside>

        {/* Painel direito: itens monitorados */}
        <main className="monitoring-main">
          <div className="monitoring-section-title">
            Itens monitorados
            <span className="monitoring-count">{monitors.length}</span>
          </div>

          {monitors.length === 0 ? (
            <div className="monitoring-placeholder">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <circle cx="24" cy="24" r="22" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
                <path d="M24 16v8l5 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              <p>Nenhum item monitorado ainda.</p>
              <span>Selecione órgãos, elementos ou subelementos na lista ao lado.</span>
            </div>
          ) : (
            <div className="monitoring-cards">
              {monitors.map((mon) => (
                <div key={mon.id} className="monitor-card">
                  <div className="monitor-card-top">
                    <div>
                      <span className={`monitor-type-badge monitor-type-badge--${mon.type}`}>
                        {TYPES.find((t) => t.key === mon.type)?.label}
                      </span>
                      <div className="monitor-card-label">{mon.label}</div>
                      <div className="monitor-card-code">Código: {mon.code}</div>
                      <div className="monitor-card-current-value">
                        Valor atual: {formatCurrency(currentValuesByMonitor[mon.id]?.value)}
                      </div>
                      <div className="monitor-card-current-period">
                        Referência: {currentValuesByMonitor[mon.id]?.period || "--"}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="monitor-remove"
                      onClick={() => removeMonitor(mon)}
                      title="Remover monitoramento"
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>

                  <div className="monitor-card-controls">
                    {/* Métrica */}
                    <div className="monitor-field">
                      <label>Métrica</label>
                      <div className="monitor-metric-tabs">
                        {METRICS.map((m) => (
                          <button
                            key={m.value}
                            type="button"
                            className={`monitor-metric-tab ${mon.metric === m.value ? "active" : ""}`}
                            onClick={() => updateMonitor(mon, "metric", m.value)}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Threshold */}
                    <div className="monitor-field">
                      <label>
                        Alertar quando variar mais de
                        <strong className="monitor-threshold-value"> {mon.threshold}%</strong>
                      </label>
                      <div className="monitor-slider-wrap">
                        <span>5%</span>
                        <input
                          type="range"
                          min={5}
                          max={100}
                          step={5}
                          value={mon.threshold}
                          className="monitor-slider"
                          onChange={(e) => updateMonitor(mon, "threshold", Number(e.target.value))}
                        />
                        <span>100%</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

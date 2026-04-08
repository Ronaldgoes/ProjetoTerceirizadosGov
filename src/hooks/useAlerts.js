import {
  arrayUnion,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
} from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { db } from "../config/firebase";
import { loadCusteioSyncPatch, mergeCusteioDataset } from "../utils/custeioSyncSession";
import { useAuth } from "./useAuth";

const METRIC_IDX = { empenhado: 5, liquidado: 6, pago: 7 };

function matchesMon(fact, mon) {
  if (mon.type === "orgao") return fact[4] === mon.code;
  if (mon.type === "elemento") return fact[2] === mon.code;
  if (mon.type === "subelemento") return fact[3] === mon.code;
  return false;
}

function factPeriodKey(fact) {
  return `${fact[0]}-${String(fact[1]).padStart(2, "0")}`;
}

function includesMonitorRange(fact, mon) {
  const period = factPeriodKey(fact);
  const startPeriod = mon.startDate ? mon.startDate.slice(0, 7) : null;
  const endPeriod = mon.endDate ? mon.endDate.slice(0, 7) : null;

  if (startPeriod && period < startPeriod) return false;
  if (endPeriod && period > endPeriod) return false;
  return true;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value || 0);
}

function formatPeriod(period) {
  if (!period) return "--";
  const [year, month] = period.split("-").map(Number);
  if (!year || !month) return period;

  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function metricLabel(metric) {
  if (metric === "pago") return "pagamento";
  if (metric === "liquidado") return "liquidação";
  if (metric === "empenhado") return "empenhamento";
  return metric;
}

function formatRange(mon) {
  const start = mon.startDate || "--";
  const end = mon.endDate || "--";
  return `${start} até ${end}`;
}

export function useAlertsRunner() {
  const { user } = useAuth();
  const lastRunKeyRef = useRef("");

  useEffect(() => {
    if (!user) {
      lastRunKeyRef.current = "";
      return;
    }

    let cancelled = false;

    (async () => {
      const patch = loadCusteioSyncPatch();
      const patchKey = patch?.syncedAt || patch?.sourceSummary?.latestPeriodAvailable || "base";
      const runKey = `${user.uid}:${patchKey}`;

      if (lastRunKeyRef.current === runKey) return;
      lastRunKeyRef.current = runKey;

      const monRef = doc(db, "users", user.uid, "monitors", "list");
      const monSnap = await getDoc(monRef);
      if (cancelled || !monSnap.exists()) return;

      const monitors = monSnap.data().items || [];
      if (!monitors.length) return;

      let custeio;
      try {
        const baseData = await fetch("/data/custeio-oficial.json").then((r) => r.json());
        custeio = patch ? mergeCusteioDataset(baseData, patch) : baseData;
      } catch {
        return;
      }

      const facts = custeio?.facts || [];
      if (!facts.length) return;

      const alertsRef = doc(db, "users", user.uid, "alerts", "list");
      const alertsSnap = await getDoc(alertsRef);
      const existing = alertsSnap.exists() ? alertsSnap.data().items || [] : [];

      for (const mon of monitors) {
        if (cancelled) return;

        const idx = METRIC_IDX[mon.metric] ?? 7;
        const relevant = facts.filter(
          (fact) => matchesMon(fact, mon) && includesMonitorRange(fact, mon)
        );
        if (!relevant.length) continue;

        const byPeriod = {};
        for (const fact of relevant) {
          const key = factPeriodKey(fact);
          byPeriod[key] = (byPeriod[key] || 0) + Number(fact[idx] || 0);
        }

        const periods = Object.keys(byPeriod).sort();
        if (periods.length < 2) continue;

        const lastPeriod = periods[periods.length - 1];
        const prevPeriod = periods[periods.length - 2];
        const lastVal = byPeriod[lastPeriod];
        const prevVal = byPeriod[prevPeriod];
        if (!prevVal) continue;

        const change = ((lastVal - prevVal) / prevVal) * 100;
        if (Math.abs(change) < mon.threshold) continue;

        const directionWord = change >= 0 ? "mais" : "menos";
        const changeRounded = Math.round(change * 10) / 10;
        const absChangeRounded = Math.round(Math.abs(change) * 10) / 10;
        const metricText = metricLabel(mon.metric);
        const summary = `Em ${formatPeriod(lastPeriod)}, ${mon.label} registrou ${formatCurrency(lastVal)} em ${metricText}, ${directionWord} ${absChangeRounded}% que ${formatPeriod(prevPeriod)} (${formatCurrency(prevVal)}) no intervalo ${formatRange(mon)}.`;
        const insight = `${mon.label} mudou ${changeRounded}% entre ${formatPeriod(prevPeriod)} e ${formatPeriod(lastPeriod)} dentro do período monitorado.`;
        const dupeKey = [
          mon.id,
          mon.metric,
          mon.threshold,
          mon.startDate || "start-open",
          mon.endDate || "end-open",
          prevPeriod,
          lastPeriod,
          patchKey,
        ].join("_");

        if (existing.some((alert) => alert.dupeKey === dupeKey)) continue;

        const alert = {
          id: uuidv4(),
          dupeKey,
          monitorId: mon.id,
          type: mon.type,
          code: mon.code,
          label: mon.label,
          metric: mon.metric,
          metricLabel: metricText,
          change: changeRounded,
          from: prevVal,
          to: lastVal,
          period: lastPeriod,
          periodLabel: formatPeriod(lastPeriod),
          prevPeriod,
          prevPeriodLabel: formatPeriod(prevPeriod),
          rangeLabel: formatRange(mon),
          threshold: mon.threshold,
          summary,
          insight,
          read: false,
          createdAt: Date.now(),
        };

        existing.push(alert);
        await setDoc(alertsRef, { items: arrayUnion(alert) }, { merge: true });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);
}

export function useAlertsSnapshot() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    if (!user) return;
    const ref = doc(db, "users", user.uid, "alerts", "list");
    const unsub = onSnapshot(ref, (snap) => {
      setAlerts(snap.exists() ? snap.data().items || [] : []);
    });
    return unsub;
  }, [user]);

  return alerts;
}

export async function markAlertRead(uid, alerts, alertId) {
  const ref = doc(db, "users", uid, "alerts", "list");
  const updated = alerts.map((a) => (a.id === alertId ? { ...a, read: true } : a));
  await setDoc(ref, { items: updated }, { merge: true });
}

export async function markAllRead(uid, alerts) {
  const ref = doc(db, "users", uid, "alerts", "list");
  const updated = alerts.map((a) => ({ ...a, read: true }));
  await setDoc(ref, { items: updated }, { merge: true });
}

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
import { useAuth } from "./useAuth";

// Índices do array fact: [ano, mes, elemento, subelemento, unidade, empenhado, liquidado, pago]
const METRIC_IDX = { empenhado: 5, liquidado: 6, pago: 7 };

function matchesMon(fact, mon) {
  if (mon.type === "orgao")       return fact[4] === mon.code;
  if (mon.type === "elemento")    return fact[2] === mon.code;
  if (mon.type === "subelemento") return fact[3] === mon.code;
  return false;
}

/**
 * Roda ao montar — verifica variações e grava alertas no Firestore.
 */
export function useAlertsRunner() {
  const { user } = useAuth();
  const ran = useRef(false);

  useEffect(() => {
    if (!user || ran.current) return;
    ran.current = true;

    (async () => {
      const monRef  = doc(db, "users", user.uid, "monitors", "list");
      const monSnap = await getDoc(monRef);
      if (!monSnap.exists()) return;

      const monitors = monSnap.data().items || [];
      if (!monitors.length) return;

      let custeio;
      try {
        custeio = await fetch("/data/custeio-oficial.json").then((r) => r.json());
      } catch { return; }

      const { facts = [] } = custeio;

      for (const mon of monitors) {
        const idx      = METRIC_IDX[mon.metric] ?? 7;
        const relevant = facts.filter((f) => matchesMon(f, mon));
        if (!relevant.length) continue;

        // Soma por período
        const byPeriod = {};
        for (const f of relevant) {
          const key = `${f[0]}/${String(f[1]).padStart(2, "0")}`;
          byPeriod[key] = (byPeriod[key] || 0) + (f[idx] || 0);
        }

        const periods = Object.keys(byPeriod).sort();
        if (periods.length < 2) continue;

        const lastPeriod = periods[periods.length - 1];
        const prevPeriod = periods[periods.length - 2];
        const lastVal    = byPeriod[lastPeriod];
        const prevVal    = byPeriod[prevPeriod];
        if (!prevVal) continue;

        const change = ((lastVal - prevVal) / prevVal) * 100;
        if (Math.abs(change) < mon.threshold) continue;

        // Evita duplicatas
        const alertsRef  = doc(db, "users", user.uid, "alerts", "list");
        const alertsSnap = await getDoc(alertsRef);
        const existing   = alertsSnap.exists() ? alertsSnap.data().items || [] : [];
        const dupeKey    = `${mon.id}_${lastPeriod}`;
        if (existing.some((a) => a.dupeKey === dupeKey)) continue;

        const alert = {
          id:         uuidv4(),
          dupeKey,
          monitorId:  mon.id,
          type:       mon.type,
          code:       mon.code,
          label:      mon.label,
          metric:     mon.metric,
          change:     Math.round(change * 10) / 10,
          from:       prevVal,
          to:         lastVal,
          period:     lastPeriod,
          prevPeriod,
          read:       false,
          createdAt:  Date.now(),
        };

        await setDoc(alertsRef, { items: arrayUnion(alert) }, { merge: true });
      }
    })();
  }, [user]);
}

/**
 * Subscreve os alertas do usuário em tempo real.
 */
export function useAlertsSnapshot() {
  const { user }          = useAuth();
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    if (!user) return;
    const ref   = doc(db, "users", user.uid, "alerts", "list");
    const unsub = onSnapshot(ref, (snap) => {
      setAlerts(snap.exists() ? snap.data().items || [] : []);
    });
    return unsub;
  }, [user]);

  return alerts;
}

/**
 * Marca um alerta como lido.
 */
export async function markAlertRead(uid, alerts, alertId) {
  const ref     = doc(db, "users", uid, "alerts", "list");
  const updated = alerts.map((a) => (a.id === alertId ? { ...a, read: true } : a));
  await setDoc(ref, { items: updated }, { merge: true });
}

/**
 * Marca todos os alertas como lidos.
 */
export async function markAllRead(uid, alerts) {
  const ref     = doc(db, "users", uid, "alerts", "list");
  const updated = alerts.map((a) => ({ ...a, read: true }));
  await setDoc(ref, { items: updated }, { merge: true });
}

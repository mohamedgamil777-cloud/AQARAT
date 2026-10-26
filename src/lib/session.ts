"use client";

/** The logged-in broker on this phone (kept in localStorage; the token is what the server trusts). */
export interface BrokerSession { token: string; name: string; phone: string }

const KEY = "aqarat-broker";

export function getSession(): BrokerSession | null {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || "null");
    return s && s.token ? s : null;
  } catch { return null; }
}

export function setSession(s: BrokerSession) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
}

export function clearSession() {
  try { localStorage.removeItem(KEY); } catch {}
}

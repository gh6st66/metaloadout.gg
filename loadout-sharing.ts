/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useState } from "react";

// Types
type ClassType = "Light" | "Medium" | "Heavy";
type WeaponId = string;
type GadgetId = string;
type SpecId = string;

export type Loadout = {
  class: ClassType | '';
  weapon: WeaponId | '';
  specialization: SpecId | '';
  gadgets: GadgetId[];
};

// ---------- URL sharing ----------
const SCHEMA_VERSION = "v1";

function encodeLoadout(l: Loadout): string {
  const payload = { v: SCHEMA_VERSION, c: l.class, w: l.weapon, g: l.gadgets, s: l.specialization };
  const json = JSON.stringify(payload);
  // Base64-url
  return btoa(unescape(encodeURIComponent(json)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeLoadout(token: string): Loadout | null {
  try {
    const padded = token + "===".slice((token.length + 3) % 4);
    const json = decodeURIComponent(escape(atob(padded.replace(/-/g, "+").replace(/_/g, "/"))));
    const obj = JSON.parse(json);
    if (obj?.v !== SCHEMA_VERSION) return null;
    return {
      class: obj.c || '',
      weapon: obj.w || '',
      gadgets: Array.isArray(obj.g) ? obj.g : [],
      specialization: obj.s || '',
    };
  } catch { return null; }
}

function toShareURL(loadout: Loadout): string {
  const u = new URL(window.location.href);
  u.searchParams.set("l", encodeLoadout(loadout));
  return u.toString();
}

function loadoutFromURL(): Loadout | null {
  const token = new URL(window.location.href).searchParams.get("l");
  if (!token) return null;
  return decodeLoadout(token);
}

// ---------- localStorage persistence ----------
const LS_KEY = "tfa.loadout.v1";

function saveLoadout(l: Loadout) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(l)); } catch {}
}

function loadLoadout(): Loadout | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as Loadout) : null;
  } catch { return null; }
}

function clearLoadout() {
  try { localStorage.removeItem(LS_KEY); } catch {}
}

// ---------- React hook ----------
const defaultInitialLoadout: Loadout = { class: '', weapon: '', specialization: '', gadgets: [] };

export function useLoadoutState(initial: Loadout = defaultInitialLoadout) {
  const [loadout, setLoadout] = useState<Loadout>(initial);

  // Hydrate on mount: URL > localStorage > initial
  useEffect(() => {
    const fromUrl = loadoutFromURL();
    if (fromUrl) {
      setLoadout(fromUrl);
      // Clean URL after loading to prevent re-loading on refresh
      const url = new URL(window.location.href);
      url.searchParams.delete('l');
      window.history.replaceState({}, document.title, url.toString());
      return;
    }
    const fromLS = loadLoadout();
    if (fromLS) {
      setLoadout(fromLS);
      return;
    }
  }, []);

  // Persist on change
  useEffect(() => {
    saveLoadout(loadout);
  }, [loadout]);

  const shareURL = useMemo(() => (loadout.class ? toShareURL(loadout) : ""), [loadout]);

  const copyShareURL = useCallback(async () => {
    if (!shareURL) return false;
    try {
      await navigator.clipboard.writeText(shareURL);
      return true;
    } catch {
      // Fallback
      const el = document.createElement("textarea");
      el.value = shareURL;
      document.body.appendChild(el);
      el.select();
      let ok = false;
      try {
        ok = document.execCommand("copy");
      } catch(e) {
        console.error("Fallback copy failed", e);
      }
      document.body.removeChild(el);
      return ok;
    }
  }, [shareURL]);

  const reset = useCallback(() => {
    clearLoadout();
    const url = new URL(window.location.href);
    url.searchParams.delete('l');
    window.history.replaceState({}, document.title, url.toString());
    setLoadout(initial);
  }, [initial]);

  return { loadout, setLoadout, shareURL, copyShareURL, reset };
}
import { useSyncExternalStore } from 'react';

export interface Settings {
  bbMode: boolean; // 金額をBB単位で表示
  raisePresets: number[]; // レイズ倍率（相手のベットの何倍か）
  betPresets: number[]; // ベット額（ポットの何%か）
}

export const DEFAULT_SETTINGS: Settings = {
  bbMode: false,
  raisePresets: [2, 2.5, 3, 4],
  betPresets: [33, 50, 75, 100],
};

const KEY = 'settings.v1';

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return DEFAULT_SETTINGS;
}

let settings = load();
const listeners = new Set<() => void>();

export function updateSettings(patch: Partial<Settings>) {
  settings = { ...settings, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
  listeners.forEach((f) => f());
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    (cb) => (listeners.add(cb), () => listeners.delete(cb)),
    () => settings,
  );
}

/** 金額表示（BB表示設定に対応） */
export function formatAmount(n: number, bb: number, bbMode: boolean): string {
  if (!bbMode) return n.toLocaleString('en-US');
  const v = n / bb;
  return `${Number.isInteger(v) ? v : v.toFixed(1)} BB`;
}

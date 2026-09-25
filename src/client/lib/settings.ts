import { useSyncExternalStore } from 'react';

export interface Settings {
  bbMode: boolean; // 金額をBB単位で表示
  fourColor: boolean; // 4色デッキ（♣緑・♦青）
  raisePresets: number[]; // レイズ倍率（相手のベットの何倍か）
  betPresets: number[]; // ベット額（ポットの何%か）
}

export const DEFAULT_SETTINGS: Settings = {
  bbMode: false,
  fourColor: true,
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

/** マークの色（4色デッキ対応） */
export function suitColor(suit: string, fourColor: boolean): string {
  if (suit === 'h') return '#d4453b';
  if (suit === 'd') return fourColor ? '#2f6fd6' : '#d4453b';
  if (suit === 'c') return fourColor ? '#1f9a55' : '#16161a';
  return '#16161a';
}

/** カード全体の塗り色（4色デッキ時はマークの色で塗りつぶし、数字は白） */
export function cardFace(suit: string, fourColor: boolean): { bg: string; fg: string } {
  if (!fourColor) return { bg: '#f7f5fb', fg: suit === 'h' || suit === 'd' ? '#d63b44' : '#17152a' };
  const bg = { s: '#4a4d66', h: '#d9434b', d: '#2f6bd6', c: '#1f9a58' }[suit] ?? '#4a4d66';
  return { bg, fg: '#ffffff' };
}

import { useState } from 'react';
import { setLang, useT } from '../lib/i18n';
import { DEFAULT_SETTINGS, updateSettings, useSettings } from '../lib/settings';
import { back, go } from '../lib/store';

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition ${on ? 'bg-[var(--color-win)]' : 'bg-white/15'}`}
    >
      <span className={`absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-[2px]'}`} />
    </button>
  );
}

/** 4つのプリセット値を編集 */
function PresetEditor({
  values, prefix, suffix, min, max, onChange,
}: { values: number[]; prefix?: string; suffix?: string; min: number; max: number; onChange: (v: number[]) => void }) {
  const [draft, setDraft] = useState(values.map(String));
  const commit = (i: number, raw: string) => {
    const n = Number(raw);
    const next = values.slice();
    if (Number.isFinite(n) && n >= min && n <= max) next[i] = Math.round(n * 10) / 10;
    onChange(next);
    setDraft(next.map(String));
  };
  return (
    <div className="mt-3 grid grid-cols-4 gap-2">
      {draft.map((v, i) => (
        <label key={i} className="glass flex items-center justify-center gap-0.5 rounded-xl px-2 py-3 text-[17px] font-semibold tabular-nums">
          {prefix && <span className="text-[var(--color-mist)]">{prefix}</span>}
          <input
            inputMode="decimal"
            value={v}
            onChange={(e) => setDraft(draft.map((d, j) => (j === i ? e.target.value : d)))}
            onBlur={(e) => commit(i, e.target.value)}
            className="w-full min-w-0 bg-transparent text-center outline-none"
            aria-label={`preset ${i + 1}`}
          />
          {suffix && <span className="text-[var(--color-mist)]">{suffix}</span>}
        </label>
      ))}
    </div>
  );
}

export function SettingsScreen() {
  const { t, lang } = useT();
  const s = useSettings();
  const [key, setKey] = useState(0); // リセット時に入力欄を作り直す

  return (
    <div className="safe-top safe-bottom mx-auto flex min-h-full max-w-md flex-col px-5">
      <header className="py-2">
        <button onClick={back} className="py-2 text-[15px] text-[var(--color-gold)]">
          ‹ {t('back')}
        </button>
      </header>
      <h1 className="rise mt-2 text-[32px] font-bold tracking-tight">{t('settings')}</h1>

      <section className="rise mt-8" style={{ animationDelay: '60ms' }}>
        <div className="text-[12px] font-medium uppercase tracking-[.2em] text-[var(--color-mist)]">{t('display')}</div>
        <div className="glass mt-3 flex items-center justify-between gap-4 rounded-xl px-4 py-3.5">
          <div>
            <div className="text-[16px] font-medium">{t('bbDisplay')}</div>
            <div className="mt-0.5 text-[12px] text-[var(--color-mist)]">{t('bbDisplaySub')}</div>
          </div>
          <Toggle on={s.bbMode} onChange={(bbMode) => updateSettings({ bbMode })} label={t('bbDisplay')} />
        </div>
        <div className="glass mt-2 flex items-center justify-between gap-4 rounded-xl px-4 py-3.5">
          <div>
            <div className="text-[16px] font-medium">{t('fourColor')}</div>
            <div className="mt-0.5 text-[12px] text-[var(--color-mist)]">{t('fourColorSub')}</div>
          </div>
          <Toggle on={s.fourColor} onChange={(fourColor) => updateSettings({ fourColor })} label={t('fourColor')} />
        </div>
      </section>

      <section key={`r${key}`} className="rise mt-8" style={{ animationDelay: '120ms' }}>
        <div className="text-[12px] font-medium uppercase tracking-[.2em] text-[var(--color-mist)]">{t('raisePresets')}</div>
        <PresetEditor values={s.raisePresets} prefix="×" min={1.1} max={20} onChange={(raisePresets) => updateSettings({ raisePresets })} />
      </section>

      <section key={`b${key}`} className="rise mt-8" style={{ animationDelay: '180ms' }}>
        <div className="text-[12px] font-medium uppercase tracking-[.2em] text-[var(--color-mist)]">{t('betPresets')}</div>
        <PresetEditor values={s.betPresets} suffix="%" min={5} max={500} onChange={(betPresets) => updateSettings({ betPresets })} />
      </section>

      <section className="rise mt-8" style={{ animationDelay: '240ms' }}>
        <div className="text-[12px] font-medium uppercase tracking-[.2em] text-[var(--color-mist)]">{t('languageLabel')}</div>
        <div className="glass mt-3 grid grid-cols-2 rounded-xl p-1">
          {(['ja', 'en'] as const).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`rounded-xl py-2.5 text-[15px] font-medium transition ${lang === l ? 'bg-white/15' : 'text-[var(--color-mist)]'}`}
            >
              {l === 'ja' ? '日本語' : 'English'}
            </button>
          ))}
        </div>
      </section>

      <button
        onClick={() => {
          updateSettings(DEFAULT_SETTINGS);
          setKey((k) => k + 1);
        }}
        className="mt-10 py-3 text-[14px] text-[var(--color-mist)]"
      >
        {t('resetDefaults')}
      </button>

      <nav className="mt-6 flex flex-col divide-y divide-white/[.06] rounded-xl bg-black/20 ring-1 ring-white/[.06]">
        {([
          ['intro', t('about')],
          ['terms', t('terms')],
          ['privacy', t('privacy')],
        ] as const).map(([k, label]) => (
          <button key={k} onClick={() => go(k)} className="flex items-center justify-between px-4 py-3.5 text-left text-[15px]">
            {label}
            <span className="text-[var(--color-gold)]">›</span>
          </button>
        ))}
      </nav>
      <p className="mt-6 text-center text-[12px] text-white/40">{t('noGambling')}</p>
    </div>
  );
}

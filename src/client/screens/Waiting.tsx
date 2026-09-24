import { useEffect, useState } from 'react';
import { useT } from '../lib/i18n';
import { go, socket, useApp } from '../lib/store';
import { OnlinePill } from './Home';

function useNow(interval = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(id);
  }, [interval]);
  return now;
}

const mmss = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

function Radar({ label }: { label: string }) {
  return (
    <div className="relative mx-auto grid h-56 w-56 place-items-center">
      {[0, 0.7, 1.4].map((d) => (
        <span key={d} className="pulse-ring absolute h-24 w-24 rounded-full border border-[#d9bf8c]/40" style={{ animationDelay: `${d}s` }} />
      ))}
      <div className="glass relative grid h-24 w-24 place-items-center rounded-full">
        <span className="font-display text-[44px] text-[var(--color-gold)]">♠</span>
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function Queue() {
  const { t } = useT();
  const q = useApp((s) => s.queue);
  const me = useApp((s) => s.me);
  const now = useNow();
  const since = q.since || now;
  const waited = now - since;
  const gap = 100 + Math.floor(waited / 5000) * 50;

  return (
    <div className="safe-top safe-bottom mx-auto flex min-h-full max-w-md flex-col px-5">
      <header className="flex justify-center py-2">
        <OnlinePill />
      </header>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <Radar label={t('searching')} />
        <h2 className="mt-8 text-[22px] font-semibold tracking-tight">
          {t('searching')}
          <span className="breathe">…</span>
        </h2>
        <div className="font-display mt-2 text-[40px] tabular-nums text-[var(--color-gold)]">{mmss(waited)}</div>
        {me && (
          <div className="mt-1 text-[13px] text-[var(--color-mist)] tabular-nums">
            {t('rating')} {me.rating - gap} – {me.rating + gap}
          </div>
        )}
        {waited >= q.cpuOfferAfter && (
          <div className="pop mt-8 w-full">
            <p className="text-[13px] text-[var(--color-mist)]">{t('cpuOffer')}</p>
            <button
              onClick={() => socket.emit('cpu:start')}
              className="glass mt-3 w-full rounded-xl px-5 py-4 text-[15px] font-medium transition active:scale-[.98]"
            >
              {t('playCpu')}
            </button>
          </div>
        )}
      </div>
      <button
        onClick={() => {
          socket.emit('queue:leave');
          go('home');
        }}
        className="mb-2 rounded-full py-4 text-[16px] text-[var(--color-mist)] hover:text-white"
      >
        {t('cancel')}
      </button>
    </div>
  );
}

export function Friend() {
  const { t } = useT();
  const f = useApp((s) => s.friend);
  const [code, setCode] = useState(f.code);

  if (f.waiting) {
    return (
      <div className="safe-top safe-bottom mx-auto flex min-h-full max-w-md flex-col px-5">
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <Radar label={t('waitingFriend')} />
          <h2 className="mt-8 text-[22px] font-semibold tracking-tight">
            {t('waitingFriend')}
            <span className="breathe">…</span>
          </h2>
          <div className="mt-4 text-[12px] uppercase tracking-[.3em] text-[var(--color-mist)]">{t('passphrase')}</div>
          <div className="font-display mt-1 text-[34px] text-[var(--color-gold)]">{f.code}</div>
        </div>
        <button
          onClick={() => socket.emit('friend:leave')}
          className="mb-2 rounded-full py-4 text-[16px] text-[var(--color-mist)] hover:text-white"
        >
          {t('cancel')}
        </button>
      </div>
    );
  }

  const valid = code.trim().length >= 2;
  return (
    <div className="safe-top safe-bottom mx-auto flex min-h-full max-w-md flex-col px-5">
      <header className="py-2">
        <button onClick={() => go('home')} className="py-2 text-[15px] text-[var(--color-gold)]">
          ‹ {t('back')}
        </button>
      </header>
      <h1 className="rise mt-6 text-[34px] font-semibold tracking-tight">{t('friend')}</h1>
      <p className="rise mt-2 text-[14px] text-[var(--color-mist)]" style={{ animationDelay: '60ms' }}>
        {t('passphraseHint')}
      </p>
      <form
        className="rise mt-8"
        style={{ animationDelay: '120ms' }}
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) socket.emit('friend:join', code);
        }}
      >
        <label className="text-[12px] uppercase tracking-[.25em] text-[var(--color-mist)]" htmlFor="code">
          {t('passphrase')}
        </label>
        <input
          id="code"
          value={code}
          onChange={(e) => setCode(e.target.value.slice(0, 32))}
          placeholder={t('passphrasePh')}
          autoComplete="off"
          autoCapitalize="off"
          className="glass mt-2 w-full rounded-xl px-5 py-4 text-[20px] outline-none placeholder:text-white/25 focus:border-[#d9bf8c]/60"
        />
        <button
          disabled={!valid}
          className="mt-4 w-full rounded-xl bg-[#f5f3ee] py-4 text-[17px] font-semibold text-[#0c0a1c] transition active:scale-[.98] disabled:opacity-30"
        >
          {t('enterRoom')}
        </button>
        <p className="mt-3 text-center text-[12px] text-white/35">{t('unrated')}</p>
      </form>
    </div>
  );
}

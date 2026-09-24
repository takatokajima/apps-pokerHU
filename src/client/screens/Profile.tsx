import { useState } from 'react';
import { AVATARS } from '../../shared/protocol';
import { Avatar } from '../components/Avatar';
import { authEnabled, getEmail, linkEmail, linkProvider, signInEmail, signInProvider, signOut } from '../lib/auth';
import { useT } from '../lib/i18n';
import { go, socket, useApp } from '../lib/store';

function AuthButton({ label, onClick, icon }: { label: string; onClick: () => void; icon: string }) {
  return (
    <button onClick={onClick} className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/[.07] py-3.5 text-[15px] font-medium ring-1 ring-white/10 transition active:scale-[.98]">
      <span className="w-5 text-center">{icon}</span>
      {label}
    </button>
  );
}

export function Profile() {
  const { t } = useT();
  const me = useApp((s) => s.me)!;
  const [name, setName] = useState(me.name);
  const [avatar, setAvatar] = useState(me.avatar);
  const [saved, setSaved] = useState(false);
  const [email, setEmail] = useState('');
  const [emailMode, setEmailMode] = useState<'link' | 'login' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [xHandle, setXHandle] = useState(me.xHandle ?? '');
  const [agreed, setAgreed] = useState(false); // 規約への同意（アカウント作成・ログイン時に必須）

  const xClean = xHandle.trim().replace(/^@/, '');
  const xValid = xClean === '' || /^[A-Za-z0-9_]{1,15}$/.test(xClean);
  const dirty = name.trim() !== me.name || avatar !== me.avatar || xClean !== (me.xHandle ?? '');
  // 同意していない場合は実行せずに案内
  const needAgree = (f: () => void) => () => (agreed ? f() : setMessage(t('agreeRequired')));
  const run = (f: () => Promise<void>) => f().catch((e: Error) => setMessage(e.message));

  return (
    <div className="safe-top safe-bottom mx-auto flex min-h-full max-w-md flex-col px-5">
      <header className="py-2">
        <button onClick={() => go('home')} className="py-2 text-[15px] text-[var(--color-gold)]">
          ‹ {t('back')}
        </button>
      </header>
      <div className="rise mt-4 flex flex-col items-center">
        <Avatar id={avatar} size={96} />
      </div>

      <section className="rise mt-8" style={{ animationDelay: '60ms' }}>
        <label htmlFor="name" className="text-[12px] uppercase tracking-[.25em] text-[var(--color-mist)]">
          {t('displayName')}
        </label>
        <input
          id="name"
          value={name}
          maxLength={16}
          onChange={(e) => {
            setName(e.target.value);
            setSaved(false);
          }}
          className="glass mt-2 w-full rounded-xl px-4 py-3.5 text-[17px] outline-none focus:border-[#d9bf8c]/60"
        />
        <div className="mt-6 text-[12px] uppercase tracking-[.25em] text-[var(--color-mist)]">{t('icon')}</div>
        <div className="mt-3 grid grid-cols-6 gap-3">
          {AVATARS.map((a) => (
            <button
              key={a}
              onClick={() => {
                setAvatar(a);
                setSaved(false);
              }}
              className={`rounded-full transition ${avatar === a ? 'ring-2 ring-[#d9bf8c] ring-offset-2 ring-offset-[#0c0a1c]' : 'opacity-70'}`}
              aria-label={a}
              aria-pressed={avatar === a}
            >
              <Avatar id={a} size={44} />
            </button>
          ))}
        </div>
        <label htmlFor="xhandle" className="mt-6 block text-[12px] uppercase tracking-[.25em] text-[var(--color-mist)]">
          {t('xAccount')}
        </label>
        <div className="glass mt-2 flex items-center rounded-xl px-4 focus-within:border-[#d9bf8c]/60">
          <span className="text-[17px] text-[var(--color-mist)]">@</span>
          <input
            id="xhandle"
            value={xHandle}
            maxLength={16}
            autoCapitalize="off"
            autoComplete="off"
            placeholder={t('xPh')}
            onChange={(e) => {
              setXHandle(e.target.value);
              setSaved(false);
            }}
            className="w-full bg-transparent px-1 py-3.5 text-[17px] outline-none placeholder:text-white/25"
            aria-invalid={!xValid}
          />
        </div>
        <button
          disabled={!dirty || !name.trim() || !xValid}
          onClick={() => {
            socket.emit('profile:update', { name: name.trim(), avatar, xHandle: xClean || null });
            setSaved(true);
          }}
          className="mt-6 w-full rounded-xl bg-[#f5f3ee] py-3.5 text-[16px] font-semibold text-[#0c0a1c] transition active:scale-[.98] disabled:opacity-30"
        >
          {saved && !dirty ? t('saved') : t('save')}
        </button>
      </section>

      <section className="rise mt-10 pb-6" style={{ animationDelay: '120ms' }}>
        <div className="hairline-gold mb-6" />
        <div className="text-[12px] uppercase tracking-[.25em] text-[var(--color-mist)]">{t('account')}</div>

        {!authEnabled ? (
          <p className="mt-3 text-[13px] leading-relaxed text-[var(--color-mist)]">{t('authDisabled')}</p>
        ) : !me.isGuest ? (
          <div className="mt-3 flex items-center justify-between">
            <span className="text-[14px] text-[var(--color-mist)]">
              {t('signedInAs')} {getEmail() ?? ''}
            </span>
            <button onClick={() => run(signOut)} className="text-[14px] text-[var(--color-lose)]">
              {t('signOut')}
            </button>
          </div>
        ) : (
          <>
            <p className="mt-2 text-[13px] text-[var(--color-mist)]">{t('keepRating')}</p>
            <label className="mt-4 flex items-start gap-3 rounded-xl bg-black/25 px-4 py-3 ring-1 ring-white/10">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[#1f9d55]" />
              <span className="text-[13px] leading-relaxed">
                <button type="button" onClick={() => go('terms')} className="text-[var(--color-gold)] underline underline-offset-2">
                  {t('terms')}
                </button>{' '}
                /{' '}
                <button type="button" onClick={() => go('privacy')} className="text-[var(--color-gold)] underline underline-offset-2">
                  {t('privacy')}
                </button>
                <br />
                {t('agreeTerms')}
              </span>
            </label>
            <div className={`mt-3 flex flex-col gap-2 transition ${agreed ? '' : 'opacity-40'}`}>
              <AuthButton icon="G" label={t('linkGoogle')} onClick={needAgree(() => run(() => linkProvider('google')))} />
              <AuthButton icon="" label={t('linkApple')} onClick={needAgree(() => run(() => linkProvider('apple')))} />
              <AuthButton icon="✉" label={t('linkEmail')} onClick={needAgree(() => setEmailMode('link'))} />
            </div>
            <div className="mt-6 text-[13px] text-[var(--color-mist)]">{t('loginExisting')}</div>
            <div className={`mt-2 flex gap-2 text-[13px] transition ${agreed ? '' : 'opacity-40'}`}>
              <button onClick={needAgree(() => run(() => signInProvider('google')))} className="flex-1 rounded-xl py-2.5 ring-1 ring-white/10">
                Google
              </button>
              <button onClick={needAgree(() => run(() => signInProvider('apple')))} className="flex-1 rounded-xl py-2.5 ring-1 ring-white/10">
                Apple
              </button>
              <button onClick={needAgree(() => setEmailMode('login'))} className="flex-1 rounded-xl py-2.5 ring-1 ring-white/10">
                Email
              </button>
            </div>
            {emailMode && (
              <form
                className="pop mt-4 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
                  run(async () => {
                    await (emailMode === 'link' ? linkEmail(email) : signInEmail(email));
                    setMessage(t('emailSent'));
                  });
                }}
              >
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('emailPh')}
                  className="glass min-w-0 flex-1 rounded-xl px-3 py-3 text-[15px] outline-none"
                />
                <button className="rounded-xl bg-[#f5f3ee] px-4 text-[14px] font-semibold text-black">→</button>
              </form>
            )}
          </>
        )}
        {message && <p className="mt-3 text-[13px] text-[var(--color-gold)]">{message}</p>}
        <p className="mt-8 text-center text-[12px] text-white/40">{t('noGambling')}</p>
      </section>
    </div>
  );
}

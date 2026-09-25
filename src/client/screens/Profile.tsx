import { Copy, LogOut, Pencil } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { AVATARS } from '../../shared/protocol';
import { Avatar } from '../components/Avatar';
import { authEnabled, getEmail, linkEmail, linkProvider, signInEmail, signInProvider, signOut } from '../lib/auth';
import { useT } from '../lib/i18n';
import { back, go, socket, useApp } from '../lib/store';

function AuthButton({ label, onClick, icon }: { label: string; onClick: () => void; icon: string }) {
  return (
    <button onClick={onClick} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#2e2a4d] py-3 text-[14px] font-bold transition active:scale-[.98]">
      <span className="w-5 text-center">{icon}</span>
      {label}
    </button>
  );
}

/** 項目名 + 値 の1行（Ten-Four のアカウント画面と同じ並び） */
function Field({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="py-2.5">
      <div className="text-[13px] font-bold text-[var(--color-mist)]">{label}</div>
      <div className="mt-1">{children}</div>
    </div>
  );
}

/** アカウント（ポップアップ内では embedded） */
export function Profile({ embedded = false }: { embedded?: boolean }) {
  const { t } = useT();
  const me = useApp((s) => s.me)!;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(me.name);
  const [avatar, setAvatar] = useState(me.avatar);
  const [saved, setSaved] = useState(false);
  const [email, setEmail] = useState('');
  const [emailMode, setEmailMode] = useState<'link' | 'login' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [xHandle, setXHandle] = useState(me.xHandle ?? '');
  const [agreed, setAgreed] = useState(false); // 規約への同意（アカウント作成・ログイン時に必須）
  const [copied, setCopied] = useState(false);

  const xClean = xHandle.trim().replace(/^@/, '');
  const xValid = xClean === '' || /^[A-Za-z0-9_]{1,15}$/.test(xClean);
  const dirty = name.trim() !== me.name || avatar !== me.avatar || xClean !== (me.xHandle ?? '');
  const needAgree = (f: () => void) => () => (agreed ? f() : setMessage(t('agreeRequired')));
  const run = (f: () => Promise<void>) => f().catch((e: Error) => setMessage(e.message));
  const save = () => {
    socket.emit('profile:update', { name: name.trim(), avatar, xHandle: xClean || null });
    setSaved(true);
    setEditing(false);
  };

  const body = (
    <div className="px-5 py-3">
      <Field label={t('playerName')}>
        {editing ? (
          <input
            autoFocus
            value={name}
            maxLength={16}
            onChange={(e) => {
              setName(e.target.value);
              setSaved(false);
            }}
            className="w-full rounded-lg bg-[#0b0a18] px-3 py-2.5 font-mono text-[15px] font-bold outline-none ring-1 ring-[#c4b8ff]/25 focus:ring-white"
          />
        ) : (
          <button onClick={() => setEditing(true)} className="flex items-center gap-2 font-mono text-[15px] font-bold" aria-label={t('playerName')}>
            {me.name}
            <Pencil size={14} className="text-[var(--color-mist)]" />
          </button>
        )}
      </Field>

      <Field label={t('icon')}>
        <div className="grid grid-cols-6 gap-2.5">
          {AVATARS.map((a) => (
            <button
              key={a}
              onClick={() => {
                setAvatar(a);
                setSaved(false);
              }}
              className={`rounded-full transition ${avatar === a ? 'ring-2 ring-[#d9bf8c] ring-offset-2 ring-offset-[#1b1834]' : 'opacity-60'}`}
              aria-label={a}
              aria-pressed={avatar === a}
            >
              <Avatar id={a} size={38} />
            </button>
          ))}
        </div>
      </Field>

      <Field label={t('userId')}>
        <button
          onClick={() => {
            void navigator.clipboard?.writeText(me.id);
            setCopied(true);
          }}
          className="flex max-w-full items-center gap-2 font-mono text-[13px] font-bold"
        >
          <span className="truncate">{me.id}</span>
          <Copy size={14} className="shrink-0 text-[var(--color-mist)]" />
          {copied && <span className="shrink-0 text-[12px] text-[#34d27b]">{t('copied')}</span>}
        </button>
      </Field>

      <Field label={t('loginMethod')}>
        <span className="font-mono text-[14px] font-bold">{me.isGuest ? t('guest') : (getEmail() ?? t('signedInAs'))}</span>
      </Field>

      <Field label={<>𝕏 {t('xAccount')}</>}>
        <div className="flex items-center rounded-lg bg-[#0b0a18] px-3 ring-1 ring-[#c4b8ff]/25 focus-within:ring-white">
          <span className="text-[15px] text-[var(--color-mist)]">@</span>
          <input
            value={xHandle}
            maxLength={16}
            autoCapitalize="off"
            autoComplete="off"
            placeholder={t('xPh')}
            onChange={(e) => {
              setXHandle(e.target.value);
              setSaved(false);
            }}
            className="w-full bg-transparent px-1 py-2.5 text-[15px] outline-none placeholder:text-white/25"
            aria-invalid={!xValid}
            aria-label={t('xAccount')}
          />
        </div>
      </Field>

      <button
        disabled={!dirty || !name.trim() || !xValid}
        onClick={save}
        className="mt-2 w-full rounded-lg bg-[#22a55e] py-3 text-[15px] font-bold text-white transition active:scale-[.98] disabled:bg-[#2e2a4d] disabled:text-white/40"
      >
        {saved && !dirty ? t('saved') : t('save')}
      </button>

      {/* ログイン・アカウント作成 */}
      <div className="mt-5 border-t border-white/10 pt-4">
        {!authEnabled ? (
          <p className="text-[13px] leading-relaxed text-[var(--color-mist)]">{t('authDisabled')}</p>
        ) : !me.isGuest ? (
          <div className="flex justify-end">
            <button onClick={() => run(signOut)} className="flex items-center gap-2 rounded-lg bg-[#2e2a4d] px-4 py-2.5 text-[14px] font-bold">
              <LogOut size={16} />
              {t('signOut')}
            </button>
          </div>
        ) : (
          <>
            <p className="text-[13px] text-[var(--color-mist)]">{t('keepRating')}</p>
            <label className="mt-3 flex items-start gap-3 rounded-lg bg-black/25 px-3 py-3 ring-1 ring-white/10">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[#1f9a58]" aria-label={t('agreeTerms')} />
              <span className="text-[13px] leading-relaxed">
                <button type="button" onClick={() => go('terms')} className="text-[#6fd6a0] underline underline-offset-2">
                  {t('terms')}
                </button>
                ・
                <button type="button" onClick={() => go('privacy')} className="text-[#6fd6a0] underline underline-offset-2">
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
            <div className="mt-4 text-[13px] text-[var(--color-mist)]">{t('loginExisting')}</div>
            <div className={`mt-2 flex gap-2 text-[13px] font-bold transition ${agreed ? '' : 'opacity-40'}`}>
              <button onClick={needAgree(() => run(() => signInProvider('google')))} className="flex-1 rounded-lg bg-[#2e2a4d] py-2.5">
                Google
              </button>
              <button onClick={needAgree(() => run(() => signInProvider('apple')))} className="flex-1 rounded-lg bg-[#2e2a4d] py-2.5">
                Apple
              </button>
              <button onClick={needAgree(() => setEmailMode('login'))} className="flex-1 rounded-lg bg-[#2e2a4d] py-2.5">
                Email
              </button>
            </div>
            {emailMode && (
              <form
                className="pop mt-3 flex gap-2"
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
                  className="min-w-0 flex-1 rounded-lg bg-[#0b0a18] px-3 py-2.5 text-[15px] outline-none ring-1 ring-[#c4b8ff]/25"
                  aria-label={t('emailPh')}
                />
                <button className="rounded-lg bg-white px-4 text-[14px] font-bold text-[#0c0a1c]">→</button>
              </form>
            )}
          </>
        )}
        {message && <p className="mt-3 text-[13px] text-[var(--color-gold)]">{message}</p>}
        <p className="mt-6 pb-2 text-center text-[11px] text-white/40">{t('noGambling')}</p>
      </div>
    </div>
  );

  if (embedded) return body;
  return (
    <div className="safe-top safe-bottom mx-auto min-h-full max-w-md">
      <header className="px-5 py-2">
        <button onClick={back} className="py-2 text-[15px] text-[var(--color-gold)]">
          ‹ {t('back')}
        </button>
      </header>
      <h1 className="px-5 text-[24px] font-bold">{t('account')}</h1>
      {body}
    </div>
  );
}

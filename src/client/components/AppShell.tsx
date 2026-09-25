import {
  Bell,
  ChartLine,
  Copy,
  FileText,
  CircleHelp,
  House,
  Info,
  Layers,
  Megaphone,
  Menu,
  Settings as SettingsIcon,
  Trophy,
  CircleUserRound,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useT } from '../lib/i18n';
import { go, setState, useApp, type Screen } from '../lib/store';
import { latestUpdateId, markUpdatesSeen, seenUpdateId, UPDATES } from '../lib/updates';
import { Profile } from '../screens/Profile';

// ナビゲーション（Ten-Four と同じく英語表記・アクティブ時にアイコンの背景色）
const NAV: { screen: Screen; label: string; Icon: LucideIcon; tint: string }[] = [
  { screen: 'home', label: 'Home', Icon: House, tint: '#3b3560' },
  { screen: 'stats', label: 'Stats', Icon: ChartLine, tint: '#2d4a7a' },
  { screen: 'leaderboard', label: 'Leaderboard', Icon: Trophy, tint: '#5e2e48' },
  { screen: 'history', label: 'Hand History', Icon: Layers, tint: '#1f5a4c' },
];

/** ロゴ（本作オリジナル: 金のスペード + HEADS-UP） */
export function LogoBadge() {
  return (
    <div className="flex items-center gap-2" aria-label="HeadsUp Online">
      <span className="grid h-7 w-7 place-items-center rounded-md bg-[#d9bf8c] text-[16px] leading-none text-[#0c0a1c]">♠</span>
      <span className="text-[15px] font-black tracking-[0.14em]">HEADS-UP</span>
    </div>
  );
}

/** 中央寄せのポップアップ */
export function Modal({ title, icon, onClose, children }: { title: string; icon?: ReactNode; onClose: () => void; children: ReactNode }) {
  // Esc キーでも閉じる
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4 backdrop-blur-[2px]" onClick={onClose}>
      <div
        className="pop flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-xl bg-[#1b1834] ring-1 ring-[#c4b8ff]/15"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={title}
      >
        <div className="relative flex items-center justify-center gap-2 border-b border-white/10 px-5 py-4 text-[16px] font-bold">
          {icon}
          {title}
          <button onClick={onClose} className="absolute right-3 grid h-9 w-9 place-items-center rounded-lg text-[var(--color-mist)] hover:bg-white/10" aria-label="close">
            <X size={20} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function UpdatesModal({ onClose }: { onClose: () => void }) {
  const { t, lang } = useT();
  const [seen] = useState(seenUpdateId);
  useEffect(() => markUpdatesSeen(), []);
  return (
    <Modal title={t('updates')} icon={<Megaphone size={18} />} onClose={onClose}>
      <p className="border-b border-white/10 px-5 py-3 text-center text-[13px] text-[var(--color-mist)]">{t('updatesNote')}</p>
      <div className="flex flex-col gap-6 px-5 py-5">
        {UPDATES.map((u) => (
          <article key={u.id} className={`border-l-2 pl-3 ${u.id > seen ? 'border-[#34d27b]' : 'border-white/20'}`}>
            <div className="flex items-center gap-2 text-[13px] text-[var(--color-mist)]">
              {u.date}
              {u.id > seen && <span className="rounded bg-[#1f9a58] px-1.5 py-0.5 text-[11px] font-bold text-white">{t('unread')}</span>}
            </div>
            <h3 className="mt-1 text-[15px] font-bold">{u.title[lang]}</h3>
            <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-white/75">{u.body[lang]}</p>
          </article>
        ))}
      </div>
    </Modal>
  );
}

function AccountModal({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  return (
    <Modal title={t('account')} icon={<CircleUserRound size={18} />} onClose={onClose}>
      <Profile embedded />
    </Modal>
  );
}

function MenuDropdown({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const me = useApp((s) => s.me);
  const [copied, setCopied] = useState(false);
  const item = (Icon: LucideIcon, label: string, onClick: () => void) => (
    <button
      key={label}
      onClick={() => {
        onClose();
        onClick();
      }}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[14px] hover:bg-white/[.06]"
    >
      <Icon size={18} className="text-[var(--color-mist)]" />
      {label}
    </button>
  );
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="pop absolute right-0 top-12 z-50 w-[296px] rounded-xl bg-[#1b1834] p-2 shadow-2xl ring-1 ring-[#c4b8ff]/15">
        <div className="border-b border-white/10 px-3 pb-3 pt-1">
          <div className="truncate text-[15px] font-bold">{me?.name}</div>
          {me && (
            <button
              onClick={() => {
                void navigator.clipboard?.writeText(me.id);
                setCopied(true);
              }}
              className="mt-0.5 flex max-w-full items-center gap-1.5 font-mono text-[11px] text-[var(--color-mist)]"
              title={t('userId')}
            >
              <span className="truncate">{me.id}</span>
              <Copy size={12} className="shrink-0" />
              {copied && <span className="shrink-0 text-[#34d27b]">{t('copied')}</span>}
            </button>
          )}
        </div>
        <div className="flex flex-col py-1">
          {item(CircleUserRound, t('account'), () => setState({ modal: 'account' }))}
          {item(SettingsIcon, t('settings'), () => go('settings'))}
        </div>
        <div className="flex flex-col border-t border-white/10 py-1">
          {item(Info, t('about'), () => go('intro'))}
          {item(CircleHelp, t('faq'), () => go('intro'))}
          {item(Megaphone, t('updates'), () => setState({ modal: 'updates' }))}
        </div>
        <div className="border-t border-white/10 pt-1">{item(FileText, t('legalBoth'), () => go('terms'))}</div>
      </div>
    </>
  );
}

/** ログイン後の共通レイアウト: 上部ヘッダー + 左ナビ（PC）/ 下部タブ（スマホ） */
export function AppShell({ children }: { children: ReactNode }) {
  const screen = useApp((s) => s.screen);
  const modal = useApp((s) => s.modal);
  const [menu, setMenu] = useState(false);
  const unread = seenUpdateId() < latestUpdateId && modal !== 'updates';

  return (
    <div className="min-h-full">
      <header className="safe-top sticky top-0 z-30 bg-[#0c0a1c]/85 backdrop-blur">
        <div className="relative mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <button onClick={() => go('home')} aria-label="Home">
            <LogoBadge />
          </button>
          <div className="flex items-center gap-1">
            <button onClick={() => setState({ modal: 'updates' })} className="relative grid h-10 w-10 place-items-center rounded-lg hover:bg-white/10" aria-label="updates">
              <Bell size={21} />
              {unread && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#34d27b]" />}
            </button>
            <button onClick={() => setMenu((v) => !v)} className={`grid h-10 w-10 place-items-center rounded-lg ${menu ? 'bg-white/10' : 'hover:bg-white/10'}`} aria-label="menu">
              <Menu size={22} />
            </button>
            {menu && <MenuDropdown onClose={() => setMenu(false)} />}
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-6 px-4">
        {/* PC: 左のナビゲーション */}
        <nav className="sticky top-16 hidden h-fit w-52 shrink-0 flex-col gap-1 pt-2 md:flex">
          {NAV.map(({ screen: s, label, Icon, tint }) => (
            <button key={s} onClick={() => go(s)} className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-left text-[14px] hover:bg-white/[.04]">
              <span className="grid h-9 w-9 place-items-center rounded-lg" style={{ background: screen === s ? tint : 'transparent' }}>
                <Icon size={19} />
              </span>
              <span className={screen === s ? 'font-bold' : 'text-white/80'}>{label}</span>
            </button>
          ))}
        </nav>
        <main className="min-w-0 flex-1 pb-28 md:pb-10">
          <div className="mx-auto max-w-[620px]">{children}</div>
        </main>
      </div>

      {/* スマホ: 下部のタブ */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-white/10 bg-[#0c0a1c]/95 backdrop-blur md:hidden">
        {NAV.map(({ screen: s, label, Icon, tint }) => (
          <button key={s} onClick={() => go(s)} className="flex flex-col items-center gap-0.5 pt-2 text-[10px]">
            <span className="grid h-8 w-10 place-items-center rounded-lg" style={{ background: screen === s ? tint : 'transparent' }}>
              <Icon size={19} />
            </span>
            <span className={screen === s ? 'font-bold' : 'text-white/60'}>{label}</span>
          </button>
        ))}
      </nav>

      {modal === 'updates' && <UpdatesModal onClose={() => setState({ modal: null })} />}
      {modal === 'account' && <AccountModal onClose={() => setState({ modal: null })} />}
    </div>
  );
}

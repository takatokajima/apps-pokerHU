import { useEffect, useRef } from 'react';
import { useT } from './lib/i18n';
import { setState, useApp } from './lib/store';
import { Home } from './screens/Home';
import { Leaderboard } from './screens/Leaderboard';
import { Profile } from './screens/Profile';
import { SettingsScreen } from './screens/Settings';
import { Intro } from './screens/Intro';
import { Legal } from './screens/Legal';
import { Stats } from './screens/Stats';
import { HandHistory } from './screens/HandHistory';
import { Table } from './screens/Table';
import { Friend, Queue } from './screens/Waiting';

export function App() {
  const { t } = useT();
  const screen = useApp((s) => s.screen);
  const me = useApp((s) => s.me);
  const connected = useApp((s) => s.connected);
  const notice = useApp((s) => s.notice);
  const table = useApp((s) => s.table);
  const scroller = useRef<HTMLDivElement>(null);

  // 画面が切り替わったら先頭から表示
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [screen]);

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setState({ notice: null }), 4000);
    return () => clearTimeout(id);
  }, [notice]);

  let view;
  // 紹介・規約ページは接続前でも表示できる
  if (screen === 'intro') view = <Intro />;
  else if (screen === 'terms') view = <Legal kind="terms" />;
  else if (screen === 'privacy') view = <Legal kind="privacy" />;
  else if (!me) view = <div className="grid h-full place-items-center text-[var(--color-mist)] breathe">{t('connecting')}</div>;
  else if (screen === 'table' && table) view = <Table />;
  else if (screen === 'queue') view = <Queue />;
  else if (screen === 'friend') view = <Friend />;
  else if (screen === 'leaderboard') view = <Leaderboard />;
  else if (screen === 'profile') view = <Profile />;
  else if (screen === 'settings') view = <SettingsScreen />;
  else if (screen === 'stats') view = <Stats />;
  else if (screen === 'history') view = <HandHistory />;
  else view = <Home />;

  return (
    <div ref={scroller} className="grain relative h-full overflow-y-auto">
      <div
        className="pointer-events-none fixed inset-0"
        style={{ background: 'radial-gradient(ellipse 70% 45% at 50% -5%, rgba(217,191,140,.13), transparent 70%)' }}
      />
      <div className="relative z-10 h-full">{view}</div>
      {me && !connected && (
        <div className="glass fixed left-1/2 top-3 z-50 -translate-x-1/2 rounded-full px-4 py-2 text-[13px]">{t('connecting')}</div>
      )}
      {notice && (
        <div className="glass pop fixed left-1/2 top-3 z-50 -translate-x-1/2 rounded-full px-4 py-2 text-[13px]">
          {notice === 'otherTab' ? t('otherTab') : notice}
        </div>
      )}
    </div>
  );
}

// 紹介ページを見たかどうか（ブラウザに保存）
const KEY = 'introSeen.v1';

export function markIntroSeen() {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    /* ignore */
  }
}

export function introSeen() {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return true;
  }
}

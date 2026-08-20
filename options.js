// ===== X Media Grid Restore : 設定ページ =====
// content.js（x.comのページ内で動くcontent script）とこのoptionsページは
// 別オリジン扱いのため、localStorageを共有できない。拡張機能全体で共有
// できるchrome.storage.localを使う。content.js側もchrome.storage.local
// を読み書きしている（Settingsオブジェクト、chrome.storage.onChangedで
// 即時反映）。
const STORAGE_KEY = 'xmr-settings';

// ---- 多言語化 ----
// 文言は_locales/{ja,en}/messages.jsonから引く（content.jsのt()と同じ方針。
// chrome.i18nが使えない異常時は空文字ではなくキー名を返して「何も表示され
// ない」事故を防ぐ）。
// Xの表示言語がja以外の時、content.jsが共有ストレージに記録した言語の
// メッセージテーブルがここに入る（下のinitOptionsLang参照）。
let optMsgTable = null;
function t(key, subs) {
  if (optMsgTable && optMsgTable[key]) {
    let m = optMsgTable[key];
    if (subs !== undefined) {
      const arr = Array.isArray(subs) ? subs : [subs];
      for (let i = arr.length - 1; i >= 0; i--) {
        m = m.split('$' + (i + 1)).join(String(arr[i]));
      }
    }
    return m;
  }
  try {
    const m = chrome.i18n.getMessage(key, subs);
    if (m) return m;
  } catch (e) {}
  return key;
}

// options.htmlは静的HTMLなのでchrome.i18nを直接使えない。data-i18n属性の
// 付いた要素のtextContentを対応するメッセージへ差し替える（title属性用は
// data-i18n-title）。HTML内の日本語テキストはそのまま残してあり、
// chrome.i18nが使えない・メッセージが見つからない場合のフォールバックに
// なる（その場合は差し替え自体をしない）。
function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const m = t(el.getAttribute('data-i18n'));
    if (m && m !== el.getAttribute('data-i18n')) el.textContent = m;
  });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => {
    const m = t(el.getAttribute('data-i18n-title'));
    if (m && m !== el.getAttribute('data-i18n-title')) el.title = m;
  });
}

// 設定ページの表示言語をXの表示言語に合わせる（実機フィードバック：
// ブラウザは日本語のままXだけ英語にしている場合、chrome.i18n＝ブラウザ
// 言語準拠だと「Xは英語なのに設定ページだけ日本語」になる）。content.jsが
// 記録した言語を読み、ja以外なら該当localeのmessages.jsonを直接読み込んで
// テーブル適用する。読めない場合は従来通りchrome.i18n（＝HTML内の日本語が
// 最終フォールバック）。
function initOptionsLang() {
  chrome.storage.local.get(['xmr-x-lang'], async (res) => {
    const lang = res && res['xmr-x-lang'];
    if (lang && lang !== 'ja') {
      try {
        const resp = await fetch(chrome.runtime.getURL('_locales/' + lang + '/messages.json'));
        const data = await resp.json();
        const tbl = {};
        Object.keys(data).forEach((k) => {
          let msg = data[k].message;
          const ph = data[k].placeholders || {};
          Object.keys(ph).forEach((pn) => {
            msg = msg.replace(new RegExp('\\$' + pn + '\\$', 'gi'), ph[pn].content);
          });
          tbl[k] = msg;
        });
        optMsgTable = tbl;
      } catch (e) {
        // テーブルが読めなければchrome.i18n/HTML内日本語のまま
      }
    }
    applyI18n();
  });
}
initOptionsLang();

const DEFAULT_KEYS = {
  moveUp: 'w',
  moveLeft: 'a',
  moveDown: 's',
  moveRight: 'd',
  openClose: 'q',
  openTweet: 'r',
  openMedia: 'f',
  like: '2',
  bookmark: '3',
  reply: '4',
  retweet: '5',
  refresh: 'c',
  profileToMedia: 'g',
  notInterested: 'x',
  goHome: '1',
};

function loadSettings(cb) {
  chrome.storage.local.get([STORAGE_KEY], (res) => {
    cb(res[STORAGE_KEY] || {});
  });
}

function flashSaved() {
  const el = document.getElementById('saved');
  el.classList.add('xmr-show');
  setTimeout(() => el.classList.remove('xmr-show'), 1200);
}

function saveSettings(partial) {
  loadSettings((current) => {
    const next = Object.assign({}, current, partial);
    chrome.storage.local.set({ [STORAGE_KEY]: next }, flashSaved);
  });
}

const hideSidebarEl = document.getElementById('hideSidebar');
const tileActionsEl = document.getElementById('tileActions');
const fTargetEl = document.getElementById('fTarget');
loadSettings((s) => {
  hideSidebarEl.checked = s.hideSidebar === true; // デフォルトOFF（サイドバーは隠さない）
  tileActionsEl.checked = s.tileActions !== false; // デフォルトON（ホバーで操作ボタンを出す）
  fTargetEl.value = s.fTarget === 'media' ? 'media' : 'profile'; // デフォルトはプロフィール
});
fTargetEl.addEventListener('change', () => {
  saveSettings({ fTarget: fTargetEl.value === 'media' ? 'media' : 'profile' });
});

// ---- 色カスタマイズ ----
// 空文字=既定色。カラーピッカーは常に何かの色を持つため、「既定に戻す」は
// 専用ボタンで空文字を保存する。
const accentColorEl = document.getElementById('accentColor');
const seenColorEl = document.getElementById('seenColor');
loadSettings((s) => {
  if (/^#[0-9a-fA-F]{6}$/.test(s.accentColor || '')) accentColorEl.value = s.accentColor;
  if (/^#[0-9a-fA-F]{6}$/.test(s.seenColor || '')) seenColorEl.value = s.seenColor;
});
accentColorEl.addEventListener('change', () => {
  saveSettings({ accentColor: accentColorEl.value });
});
seenColorEl.addEventListener('change', () => {
  saveSettings({ seenColor: seenColorEl.value });
});
document.getElementById('accentColorReset').addEventListener('click', (e) => {
  e.preventDefault();
  accentColorEl.value = '#1d9bf0';
  saveSettings({ accentColor: '' });
});
document.getElementById('seenColorReset').addEventListener('click', (e) => {
  e.preventDefault();
  seenColorEl.value = '#1c3a56';
  saveSettings({ seenColor: '' });
});
hideSidebarEl.addEventListener('change', () => {
  saveSettings({ hideSidebar: hideSidebarEl.checked });
});
tileActionsEl.addEventListener('change', () => {
  saveSettings({ tileActions: tileActionsEl.checked });
});

// ---- キー割り当て ----
// Space/Esc/矢印キーは固定。それ以外（WASD移動・Q開閉・単発アクションキー）は
// 1文字のテキスト入力でリマップできる（重複は保存されない）。
const keyInputs = {};
Object.keys(DEFAULT_KEYS).forEach((name) => {
  keyInputs[name] = document.getElementById('key-' + name);
});
const keyErrorEl = document.getElementById('keyError');

function currentKeysFromInputs() {
  const keys = {};
  Object.keys(keyInputs).forEach((name) => {
    keys[name] = (keyInputs[name].value || '').toLowerCase();
  });
  return keys;
}

// 移動と開閉はグリッド操作の根幹なので空欄（割り当てなし）を許可しない。
// それ以外のアクションキーは空欄＝無効化を許可する（例：リポストを使わない
// 人がキーを消しておけば誤爆しようがない、という安全策）。
const REQUIRED_KEYS = ['moveUp', 'moveDown', 'moveLeft', 'moveRight', 'openClose'];

function validateKeys(keys) {
  const seen = new Map(); // key文字 -> 最初に使った項目名
  for (const name of Object.keys(keys)) {
    const k = keys[name];
    if (!k) {
      if (REQUIRED_KEYS.includes(name)) return t('optErrRequired', [name]);
      continue; // 空欄＝割り当てなし（そのキーの機能は無効になる）
    }
    if (k === ' ') return t('optErrSpace');
    if (seen.has(k)) return t('optErrDuplicate', [k, seen.get(k), name]);
    seen.set(k, name);
  }
  return null;
}

function refreshKeyInputStyles(errorNames) {
  Object.keys(keyInputs).forEach((name) => {
    keyInputs[name].classList.toggle('xmr-key-error', errorNames.has(name));
  });
}

function onKeyInputChange() {
  const keys = currentKeysFromInputs();
  const err = validateKeys(keys);
  if (err) {
    keyErrorEl.textContent = err;
    // どの項目が重複しているか分かるよう、同じ文字を持つ項目に印を付ける
    const byChar = {};
    Object.keys(keys).forEach((name) => {
      const k = keys[name];
      if (!k) return;
      (byChar[k] = byChar[k] || []).push(name);
    });
    const errorNames = new Set();
    Object.values(byChar).forEach((names) => {
      if (names.length > 1) names.forEach((n) => errorNames.add(n));
    });
    Object.keys(keys).forEach((name) => {
      if (!keys[name] && REQUIRED_KEYS.includes(name)) errorNames.add(name);
      if (keys[name] === ' ') errorNames.add(name);
    });
    refreshKeyInputStyles(errorNames);
    return; // 保存しない（重複/空のままではXの操作に支障が出るため）
  }
  keyErrorEl.textContent = '';
  refreshKeyInputStyles(new Set());
  saveSettings({ keys });
}

loadSettings((s) => {
  const keys = Object.assign({}, DEFAULT_KEYS, s.keys || {});
  Object.keys(keyInputs).forEach((name) => {
    keyInputs[name].value = keys[name];
  });
});
Object.values(keyInputs).forEach((input) => {
  input.addEventListener('input', onKeyInputChange);
});

document.getElementById('resetKeys').addEventListener('click', () => {
  Object.keys(keyInputs).forEach((name) => {
    keyInputs[name].value = DEFAULT_KEYS[name];
  });
  keyErrorEl.textContent = '';
  refreshKeyInputStyles(new Set());
  saveSettings({ keys: Object.assign({}, DEFAULT_KEYS) });
});

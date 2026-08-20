// ===== X Media Grid Restore : background service worker =====
// R/Fキー等でX上から開いた新しいタブを閉じたとき、ブラウザの既定動作
// （隣接タブ、多くの場合「右側」）ではなく、必ず元のタブ（開いた側）へ
// フォーカスを戻す。これはタブの開閉・フォーカス制御そのものであり、
// content script（ページ内のJS）からは行えない領域なので、
// chrome.tabsを使えるbackground（拡張機能側）で行う。
//
// 表示専用というこの拡張機能の方針に沿って、対象はx.com/twitter.comを
// 開いていたタブから開かれたタブだけに限定する（ブラウザ全体のタブ挙動を
// 変えるものではない）。

const openerMap = new Map(); // 子タブID -> 開いた側のタブID

chrome.tabs.onCreated.addListener((tab) => {
  if (tab.openerTabId == null) return;
  chrome.tabs.get(tab.openerTabId, (opener) => {
    if (chrome.runtime.lastError || !opener || !opener.url) return;
    if (/^https:\/\/(x\.com|twitter\.com)\//.test(opener.url)) {
      openerMap.set(tab.id, tab.openerTabId);
    }
  });
});

chrome.tabs.onRemoved.addListener((tabId) => {
  const openerTabId = openerMap.get(tabId);
  openerMap.delete(tabId);
  if (openerTabId == null) return;
  chrome.tabs.get(openerTabId, (opener) => {
    if (chrome.runtime.lastError || !opener) return; // 元のタブも既に閉じられている等
    chrome.tabs.update(openerTabId, { active: true }, () => {
      // 対象タブが既に閉じられている等のエラーは無視して良い
      void chrome.runtime.lastError;
    });
  });
});

// 設定ページ(options.html)は brave://extensions の詳細から開く必要があり
// 分かりにくいという指摘があったため、ツールバーに直接開けるボタンを
// 追加した。chrome.runtime.openOptionsPage()はcontent script側からは
// 呼べない（背景ページ/拡張機能ページからのみ）ため、メッセージ経由で
// ここから開く。
chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === 'xmr-open-options') {
    chrome.runtime.openOptionsPage();
  }
});

// 【v3.45.0で削除】以前はここにchrome.debugger(CDP)経由の擬似ホイール
// スクロール(simulateWheelScroll)があった。Xの仮想リスト再同期の最終手段
// だったが、実機で「message port closed」により時々失敗する・効果自体も
// 実機で確認できなかった一方、「本物のリロード」は確実に効くと確定済みの
// ため、content.js側のtryResyncReload()（リロード方式）に一本化し、
// debugger権限ごと廃止した。警告バー（「拡張機能がこのブラウザをデバッグ
// しています」）も二度と出なくなった。

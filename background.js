// ===== X Media Grid : background service worker =====
//
// この拡張機能のバックグラウンド側の役割は1つだけ：設定ページを開くこと。
// 権限は storage のみ（chrome.tabs も chrome.debugger も使わない）。
//
// 【v3.74.0で削除】以前はここに「R/Fキーで開いた新しいタブを閉じたとき、
// 元のタブへフォーカスを戻す」処理（chrome.tabs.onCreated/onRemoved）が
// あった。削除した理由：
//  (1) v3.55.0でR/Fキーは同タブSPA遷移(openEntrySameTab)に切り替わり、
//      拡張機能自身が新しいタブを開くことは無くなった。残っていたのは
//      ユーザーのCtrl+クリック等だけで、その場合ブラウザ標準の挙動で
//      十分だった。
//  (2) MV3のservice workerはアイドルで停止するため、モジュールスコープの
//      openerMapは数十秒で消える。つまり機能自体がほとんど働いていなかった。
//  (3) 上記のために必要だったtabs権限は、ブラウザ全体のタブ生成を監視し
//      開いた側のURLを読む強い権限で、得られる価値に見合わない。
// 結果として必要な権限は storage だけになった。
//
// 【v3.45.0で削除】さらに以前はchrome.debugger(CDP)経由の擬似ホイール
// スクロールもあったが、効果が実機で確認できず、警告バー（「拡張機能が
// このブラウザをデバッグしています」）の代償も大きいため廃止した。

// 設定ページ(options.html)は brave://extensions の詳細から開く必要があり
// 分かりにくいという指摘があったため、ツールバーに直接開けるボタンを
// 追加した。chrome.runtime.openOptionsPage()はcontent script側からは
// 呼べない（拡張機能ページからのみ）ため、メッセージ経由でここから開く。
// この機能に追加の権限は不要。
chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === 'xmr-open-options') {
    chrome.runtime.openOptionsPage();
  }
});

# Xメディアグリッド / X Media Grid

X（旧Twitter）のメディア欄・ホーム・いいね・ブックマーク・検索結果を画像グリッド表示に変え、
**投稿を開かずに** いいね・ブックマーク・リポスト・リプライができる、閲覧特化のChrome/Brave拡張機能です。

Turn X's media tab, home timeline, likes, bookmarks and search results into an image grid —
and like, bookmark, repost or reply **without opening a single post**.
For people who open X to look at images.

> **Chrome ウェブストアで公開中 / Available on the Chrome Web Store**
> https://chromewebstore.google.com/detail/hhfmclfmffmddecaepcgpfiffjmbebim
>
> Chrome・Brave・Edge など Chromium 系ブラウザで使えます。

## 主な機能 / Features

- **画像を優先して表示** — 最近のXはメディア欄を開くと動画側が出ます。この拡張は画像側を優先して開きます。動画を見たい時はツールバーの「動画」をワンクリックするか、設定で動画優先に戻せます
- **グリッド表示** — メディア欄/ホーム/いいね/ブックマーク/検索結果を画像グリッド化
- **ワンクリックでON/OFF** — 画面左下のボタンを押すだけでXの通常表示に戻せます。設定画面を開く必要はありません。ON/OFFは場所ごとに記憶するので「メディア欄はグリッド、ホームは通常表示」も可能
- **列数は1〜10** — しかも場所ごとに別々に記憶します（メディア欄は3列、ホームは5列…といった使い分けがそのまま残ります）
- **開かずに操作** — ホバーで ♥/🔖/🔁/💬。同じ操作をキーボードからも行えます
- **キーボード閲覧** — WASD/矢印で移動、Qで拡大、Spaceでスクロール。**キー割り当ては全て変更可能・使わないキーは無効化も可能**
- **未読管理** — 既読の投稿は帯に色が付く。「未読のみ表示」で新着だけを一気にチェック
- **速い** — 同タブ即時遷移＋戻れば元の位置に復帰（グリッド状態のスナップショット復元）
- **数字表示** — いいね/リポスト/リプ数を帯に、表示回数を拡大ビューに
- **カスタマイズ** — アクセント色・既読色、ライト/ダーク両テーマ、日英UI自動切替（Xの表示言語に追従）

## 安全設計 / Safety by design

- **表示専用** — 自動いいね・自動フォロー・自動投稿・スクレイピングは一切ありません。操作が実行されるのは、あなたがキーやボタンを押したその時だけです
- **連打しません** — いいね等のキーは押しっぱなしにしてもOSのキーリピートで連発しません（1回の入力＝1回の操作）
- **外部送信ゼロ** — 設定も既読履歴もすべてブラウザ内(localStorage / chrome.storage)。アナリティクスもトラッキングもありません
- **最小権限** — 要求する権限は `storage`（設定保存）**ただ1つ**。閲覧履歴もタブ一覧も読みません。動作するのは x.com / twitter.com のページ内だけです
- **Minimal permissions** — `storage` and nothing else. No history, no tab access; it runs only inside x.com / twitter.com

詳細は [PRIVACY.md](PRIVACY.md) / See [PRIVACY.md](PRIVACY.md) for the full privacy policy.

## 手動インストール / Manual install (developer mode)

1. このリポジトリをダウンロード（Code → Download ZIP → 展開）
2. `chrome://extensions`（Braveは `brave://extensions`）を開き「デベロッパーモード」をON
3. 「パッケージ化されていない拡張機能を読み込む」→ 展開したフォルダを選択

## 開発について / Development

この拡張機能は、AIコーディングエージェント（Claude）とペアで開発されています。
実機のX上でのライブ検証を繰り返しながら60以上のバージョンを重ねており、
その全過程は [CHANGELOG.md](CHANGELOG.md) に記録されています
（何が壊れ、どう原因を特定し、どう直したかの生ログです）。

This extension is developed in pair with an AI coding agent (Claude), iterating through
60+ versions with live in-browser verification on X. The full development log — every bug,
root cause and fix — is preserved in [CHANGELOG.md](CHANGELOG.md).

## License

[MIT](LICENSE)

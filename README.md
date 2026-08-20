# Xメディアグリッド / X Media Grid

X（旧Twitter）のメディア欄・ホーム・いいね・ブックマーク・検索結果を画像グリッド表示に変え、
**投稿を開かずに** いいね・ブックマーク・リポスト・リプライができる、閲覧特化のChrome/Brave拡張機能です。

Turn X's media tab, home timeline, likes, bookmarks and search results into an image grid —
and like, bookmark, repost or reply **without opening a single post**. Built for art lovers.

> Chrome Web Store: （審査通過後にリンクを掲載 / link coming after review）

## 主な機能 / Features

- **グリッド表示** — メディア欄/ホーム/いいね/ブックマーク/検索結果を画像グリッド化（列数1〜10）
- **開かずに操作** — ホバーで ♥/🔖/🔁/💬、キーボードなら1キー（いいね=2 / ブックマーク=3 / リプライ=4 / リポスト=5）
- **キーボード閲覧** — WASD/矢印で移動、Qで拡大、Spaceでスクロール。全キーリマップ可・無効化可
- **未読管理** — 既読の投稿は帯に色が付く。「未読のみ表示」で新着だけを一気にチェック
- **速い** — 同タブ即時遷移＋戻れば元の位置に復帰（グリッド状態のスナップショット復元）
- **数字表示** — いいね/リポスト/リプ数を帯に、表示回数を拡大ビューに
- **カスタマイズ** — アクセント色・既読色、ライト/ダーク両テーマ、日英UI自動切替（Xの表示言語に追従）

## 安全設計 / Safety by design

- **表示専用** — 自動いいね・自動フォロー・自動投稿・スクレイピングは一切ありません。操作が実行されるのは、あなたがキーやボタンを押したその時だけです
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

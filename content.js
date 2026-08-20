// ===== X Media Grid Restore =====
// 表示専用の Content Script。DOMの見た目とキー操作だけを変更し、
// 自動いいね/自動フォロー/投稿/スクレイピング等は一切行わない。
(function () {
  'use strict';

  // Fキーで新しいタブにメディア欄を開いた時、Xの初期スクロール位置の
  // 復元が古いスナップショットのまま最新の投稿を反映しないことがあった
  // （実機報告：リロードすると直る）。urlForEntry()が付ける#xmr-fresh
  // マーカーを検知し、他の初期化が始まる前に1回だけ自動でリロードする
  // （マーカーを外してから呼ぶので無限ループにはならない）。
  if (location.hash === '#xmr-fresh') {
    history.replaceState(null, '', location.pathname + location.search);
    // 再同期リロード(tryResyncReload)のガードにも記録しておく：この直後の
    // 読み込みでまた「直らない」と判定されても、二重リロードにはならず
    // 従来のヒント表示にフォールバックする。キー文字列は下の
    // RESYNC_RELOAD_KEYと同じ値（このブロックはconst宣言より前に実行される
    // ためTDZの関係で定数を参照できず、リテラルで書いている）。
    try {
      sessionStorage.setItem('xmr-resync-reload', JSON.stringify({ href: location.href, at: Date.now() }));
    } catch (e) {}
    location.reload();
    return;
  }

  // ---- 多言語化ヘルパー ----
  // 拡張自身が表示する文言はすべて_locales/{ja,en}/messages.json から引く
  // （ja がdefault_locale。ブラウザのUI言語で自動切替）。chrome.i18nが
  // 使えない異常時は空文字ではなくキー名を返して「何も表示されない」事故を
  // 防ぐ。プレースホルダは$1,$2...（messages.json側のplaceholders定義参照）。
  // Xのページから読み取る文言（タブ名・カウント等）はここを通さない。
  // chrome.i18nのカタログが読めない環境でもUIがキー名だらけにならないよう、
  // 日本語のフォールバック表を内蔵する。実機で確認した具体例：_locales/
  // default_localeを「後から追加」した未パッケージ拡張は、runtime.reload()
  // ではカタログが再構築されず getMessage が空を返し続ける（brave://extensions
  // からの手動再読み込み or 入れ直しで直る）。その状態でも従来通りの日本語で
  // 表示できるようにする。この表は _locales/ja/messages.json から機械生成した
  // もので、内容は同一（プレースホルダは$1..$n形式に変換済み）。
  // 文言テーブル（_locales/{ja,en}/messages.jsonから機械生成・内容同一。
  // プレースホルダは$1..$n形式に変換済み）。
  // 【言語の選び方・実機フィードバックによる方針】拡張のUI言語は
  // ブラウザ言語(chrome.i18n)ではなく「Xの表示言語」(<html lang>)に
  // 合わせる。イラスト目的のユーザーはブラウザは日本語のままXだけ
  // 英語表示にしていることがあり、「Xは英語なのに拡張だけ日本語」に
  // なるのを避けるため。ja以外は全てenにフォールバックする。
  // ※optionsページは従来通りchrome.i18n（ブラウザ言語）を使う。
  const I18N_TABLES = {
    "ja": {
      "extDescription": "Xのメディア欄・ホーム・いいねを画像グリッドに変え、投稿を開かずにいいね・ブックマーク・リポスト。キーボードだけでサクサク絵を見て回れる閲覧特化ツール（表示専用・自動操作なし）",
      "imageOnlyLabel": "画像のみ表示($1)",
      "scopeBookmarks": "ブックマーク",
      "scopeMedia": "メディア",
      "scopeLikes": "いいね",
      "scopeSearch": "検索結果",
      "overlayHint": "$1 移動 / $2 拡大・戻る / Esc 閉じる",
      "overlayCloseButton": "閉じる ($1)",
      "viewerOpenAuthorPage": "@$1 のページを開く",
      "viewerLike": "いいね",
      "viewerBookmark": "ブックマーク",
      "viewerRepost": "リポスト",
      "viewerReply": "リプライ",
      "withKey": "$1（$2キー）",
      "titleLikeToggle": "いいね/解除",
      "titleBookmarkToggle": "ブックマーク/解除",
      "titleRepostToggle": "リポスト/解除",
      "titleReply": "リプライ",
      "viewerOpenPost": "このポストを開く（$1）",
      "viewerOpenAccountMedia": "このアカウントを開く（$1）",
      "toastLiked": "いいねしました",
      "toastUnliked": "いいねを解除しました",
      "toastBookmarked": "ブックマークしました",
      "toastBookmarkRemoved": "ブックマークを解除しました",
      "toastReposted": "リポストしました",
      "toastRepostRemoved": "リポストを解除しました",
      "toastDone": "実行しました",
      "toastSearchUnsupported": "検索結果の一覧からは直接実行できません（$1キーでツイートを開いて操作できます）",
      "toastRelocateFailed": "元の投稿を再表示できませんでした（$1キーでツイートを開いて操作できます）",
      "toastNoSelection": "投稿が選択されていません",
      "toastActionButtonNotFound": "操作ボタンが見つかりませんでした",
      "toastRepostButtonNotFound": "リポストボタンが見つかりませんでした",
      "toastRepostConfirmNotFound": "リポストの確認ボタンが見つかりませんでした",
      "toastReplyButtonNotFound": "リプライボタンが見つかりませんでした",
      "toastReplyOpenFailed": "リプライ画面を開けませんでした",
      "filterUnread": "未読のみ表示",
      "filterVideoOnly": "動画のみ表示",
      "noText": "(本文なし)",
      "refreshing": "更新中…",
      "loading": "読み込み中…",
      "toolbarLikes": "いいね",
      "toolbarBookmarks": "ブックマーク",
      "toolbarRefresh": "更新",
      "toolbarCols": "列数",
      "toolbarSettings": "設定",
      "toolbarSettingsTitle": "設定・キー操作一覧",
      "toolbarThisAccount": "このアカウント:",
      "toolbarSearch": "検索",
      "pillPhotos": "画像",
      "pillVideos": "動画",
      "optTitle": "Xメディアグリッド - 設定",
      "optSub": "表示設定とキー操作の一覧",
      "optDisplayHeading": "表示設定",
      "optHideSidebarLabel": "グリッド表示中は右サイドバーを隠す",
      "optHideSidebarDesc1": "初期値：オフ（サイドバーはそのまま表示）。",
      "optHideSidebarDesc2": "オン：サイドバーを隠して横幅をグリッドに使う。代わりにツールバーに「検索」ボタンが出て、押すと検索の時だけ一時的にサイドバーを表示します。",
      "optTileActionsLabel": "タイルにマウスを乗せた時に操作ボタンを表示",
      "optTileActionsDesc": "初期値：オン。グリッドの各画像の右上に「♥ / 🔖 / 💬」（いいね・ブックマーク・リプライ）のボタンが出ます。キー操作派で不要ならオフに。",
      "optSaved": "保存しました",
      "optKeysHeading": "キー操作一覧",
      "optKeyMoveUp": "上へ移動（↑キーも常に有効）",
      "optKeyMoveDown": "下へ移動（↓キーも常に有効）",
      "optKeyMoveLeft": "左へ移動・複数画像は前の画像（←キーも常に有効）",
      "optKeyMoveRight": "右へ移動・複数画像は次の画像（→キーも常に有効）",
      "optKeyOpenClose": "開く（1枚ならそのまま拡大、複数なら一覧へ）／閉じる・1つ戻る",
      "optKeySpace": "グリッド一覧では1画面分くらい滑らかにスクロール／複数画像の一覧では選択中の1枚を単独表示",
      "optKeyEsc": "閉じる",
      "optKeyOpenTweet": "そのツイートを開く（同じタブで即表示。戻ると元の位置に復帰）",
      "optKeyOpenMedia": "その投稿者のページを開く（行き先は上の表示設定で選択）",
      "optKeyLike": "いいね",
      "optKeyBookmark": "ブックマーク",
      "optKeyReply": "リプライ（Xの返信入力画面がその場で開く。入力・送信は通常通り自分で行う）",
      "optKeyRetweet": "リポスト／解除（引用ではなく通常のリポスト。引用したい時はツイートを開いてから）",
      "optKeyRefresh": "ホームを更新（「おすすめ」タブのみ）",
      "optKeyProfileToMedia": "プロフィールページでそのアカウントのメディア欄へ移動",
      "optKeyNotInterested": "ホバー中のポストの「•••」メニューを開く（開いている間は上下移動キー（初期値W/S）でメニュー内を移動、Spaceで選択、開閉キー（初期値Q）で閉じる）",
      "optKeyGoHome": "ホームへ戻る（新しいタブは開かず、同じタブ内で本物のホームアイコンを押すのと同じ）",
      "optResetKeys": "キー割り当てを初期値に戻す",
      "optNoteFixed": "Space・Esc・矢印キーは固定です。それ以外は上の表の入力欄に1文字のキーを入力すると自動保存されます（他のキーと重複はできません）。",
      "optNoteBlank1": "移動・開閉の5つ以外は",
      "optNoteBlank2": "空欄にすると「割り当てなし」",
      "optNoteBlank3": "になり、その機能はキーでは動かなくなります（例：リポストを使わない人の誤爆防止）。",
      "optAboutBadge": "この拡張機能について",
      "optAboutIntro": "X（旧Twitter）のメディア/いいね/ブックマーク/ホームを、画像がずらっと並ぶグリッド表示に変えて、キーボードだけでサクサク見て回れるようにする拡張機能です。いいね・ブックマーク・フォローなども1キーで行えます。以下、主な機能を重要な順に紹介します。",
      "optFeat1H": "1. グリッド表示",
      "optFeat1a": "メディア欄・いいねの履歴・ブックマーク・ホーム（「画像のみ表示」ON時）を、画像が並ぶグリッド（Pinterest風）に変換します。",
      "optFeat1b": "W/A/S/D（または矢印キー）で選択を移動、Qで開く/閉じる、Spaceで1画面分スクロールや画像の拡大ができます。",
      "optFeat1c": "グリッドの列数はツールバーからお好みで変更できます。",
      "optFeat2H": "2. 画像のみ表示",
      "optFeat2a": "ホーム／ブックマークでは、画像の無い投稿を除いてグリッド化するかどうかをボタンでON/OFFできます。",
      "optFeat2b": "ホームは「おすすめ」「フォロー中」等のタブごとに、ブックマークとは別々に設定を覚えます。",
      "optFeat3H": "3. 複数画像の投稿",
      "optFeat3a": "クリック（またはQ）すると、投稿内の画像が最初から全部大きく並んで表示されます。Spaceで1枚をさらに大きく表示、A/Dで送れます。",
      "optFeat4H": "4. 未読のみ表示・動画のみ表示",
      "optFeat4a": "グリッド内のボタンで、まだ見ていない投稿だけ・動画の投稿だけに絞り込めます。",
      "optFeat5H": "5. メディア欄の「画像」「動画」切り替え",
      "optFeat5a": "メディア欄を開くと画像がデフォルトで表示され、上部のボタンで動画だけの表示にも切り替えられます。",
      "optFeat6H": "6. プロフィールカード",
      "optFeat6a": "メディア欄の先頭に、アイコン・名前・自己紹介・フォロー数などをまとめた小さなカードとフォローボタンを表示します。",
      "optFeat7H": "7. キーボードショートカット（リマップ可）",
      "optFeat7a": "投稿を開く／その人のメディア欄を開く／いいね／ブックマーク／ホーム更新／メニューを開く／ホームへ戻る、が1キーで行えます。",
      "optFeat7b": "グリッドを使っていない通常のタイムラインでも、WASDQで投稿を選んで同じ操作ができます。",
      "optFeat8H": "8. その他",
      "optFeat8a": "右サイドバーの表示/非表示も切り替え可能です（左の設定を参照）。",
      "optErrRequired": "$1は移動・開閉の必須キーのため空欄にできません",
      "optErrSpace": "スペースは固定のスクロール操作と衝突するため割り当てられません",
      "optErrDuplicate": "「$1」が$2と$3で重複しています",
      "optFTargetLabel": "Fキー（投稿者ページ）の行き先",
      "optFTargetProfile": "プロフィール（ポスト一覧）",
      "optFTargetMedia": "メディア欄（画像一覧）",
      "optFTargetDesc": "初期値：プロフィール（ポスト一覧）。画像だけを追いたい人は「メディア欄」に変更してください。",
      "optAccentLabel": "アクセント色",
      "optAccentDesc": "初期値：Xと同じ青。選択中の枠線・タブの下線・ボタン等の青系をまとめて変更できます。",
      "optSeenColorLabel": "既読の色",
      "optSeenColorDesc": "一度見た投稿は、タイル下の帯がこの色になります（どこまで読んだかの目印。既読の記録は更新やページ移動のタイミングで付きます）。初期値はテーマに合わせた青系。",
      "optColorReset": "初期値に戻す",
      "extName": "Xメディアグリッド",
      "bannerNewPosts": "新しいポストを表示",
      "optNewPostsBannerLabel": "グリッド上に「新しいポストを表示」を出す",
      "optNewPostsBannerDesc": "初期値：オン。ホームのグリッド表示中、新着が届いたら上部にバナーが出て、クリックで取り込みます。",
      "optHideHomeDotLabel": "ホームの青い未読ドットを隠す",
      "optHideHomeDotDesc": "初期値：オフ（表示する）。左ナビのホームアイコンに付く小さな青丸を隠します。",
      "optHideNotifBadgeLabel": "通知の数字バッジを隠す",
      "optHideNotifBadgeDesc": "初期値：オフ（表示する）。ブラウザ通知等で確認済みの人向けに、左ナビの通知アイコンの数字バッジを隠します。"
    },
    "en": {
      "extDescription": "Turn X's media tab, home & likes into an image grid. Like, bookmark & repost without opening posts. Display-only, no automation.",
      "imageOnlyLabel": "Images only ($1)",
      "scopeBookmarks": "Bookmarks",
      "scopeMedia": "Media",
      "scopeLikes": "Likes",
      "scopeSearch": "Search results",
      "overlayHint": "$1 Move / $2 Zoom · Back / Esc Close",
      "overlayCloseButton": "Close ($1)",
      "viewerOpenAuthorPage": "Open @$1's page",
      "viewerLike": "Like",
      "viewerBookmark": "Bookmark",
      "viewerRepost": "Repost",
      "viewerReply": "Reply",
      "withKey": "$1 ($2 key)",
      "titleLikeToggle": "Like / unlike",
      "titleBookmarkToggle": "Bookmark / remove",
      "titleRepostToggle": "Repost / undo",
      "titleReply": "Reply",
      "viewerOpenPost": "Open this post ($1)",
      "viewerOpenAccountMedia": "Open this account ($1)",
      "toastLiked": "Liked",
      "toastUnliked": "Unliked",
      "toastBookmarked": "Bookmarked",
      "toastBookmarkRemoved": "Bookmark removed",
      "toastReposted": "Reposted",
      "toastRepostRemoved": "Repost removed",
      "toastDone": "Done",
      "toastSearchUnsupported": "Actions can't be run directly from search results (press $1 to open the tweet and act there)",
      "toastRelocateFailed": "Could not re-locate the original post (press $1 to open the tweet and act there)",
      "toastNoSelection": "No post is selected",
      "toastActionButtonNotFound": "Could not find the action button",
      "toastRepostButtonNotFound": "Could not find the repost button",
      "toastRepostConfirmNotFound": "Could not find the repost confirmation button",
      "toastReplyButtonNotFound": "Could not find the reply button",
      "toastReplyOpenFailed": "Could not open the reply composer",
      "filterUnread": "Unread only",
      "filterVideoOnly": "Videos only",
      "noText": "(no text)",
      "refreshing": "Refreshing…",
      "loading": "Loading…",
      "toolbarLikes": "Likes",
      "toolbarBookmarks": "Bookmarks",
      "toolbarRefresh": "Refresh",
      "toolbarCols": "Columns",
      "toolbarSettings": "Settings",
      "toolbarSettingsTitle": "Settings & keyboard shortcuts",
      "toolbarThisAccount": "This account:",
      "toolbarSearch": "Search",
      "pillPhotos": "Photos",
      "pillVideos": "Videos",
      "optTitle": "X Media Grid - Settings",
      "optSub": "Display settings and keyboard shortcuts",
      "optDisplayHeading": "Display settings",
      "optHideSidebarLabel": "Hide the right sidebar while the grid is shown",
      "optHideSidebarDesc1": "Default: off (the sidebar stays visible).",
      "optHideSidebarDesc2": "On: hides the sidebar so the grid can use the extra width. A \"Search\" button appears in the toolbar instead; pressing it shows the sidebar temporarily, just for searching.",
      "optTileActionsLabel": "Show action buttons when hovering over a tile",
      "optTileActionsDesc": "Default: on. \"♥ / 🔖 / 💬\" buttons (like, bookmark, reply) appear at the top right of each image in the grid. Turn this off if you prefer keyboard-only use.",
      "optSaved": "Saved",
      "optKeysHeading": "Keyboard shortcuts",
      "optKeyMoveUp": "Move up (the ↑ key always works too)",
      "optKeyMoveDown": "Move down (the ↓ key always works too)",
      "optKeyMoveLeft": "Move left; previous image in multi-image posts (the ← key always works too)",
      "optKeyMoveRight": "Move right; next image in multi-image posts (the → key always works too)",
      "optKeyOpenClose": "Open (zooms a single image directly, opens the list for multiple images) / close · go back one level",
      "optKeySpace": "In the grid, smoothly scrolls about one screen; in a multi-image list, shows the selected image on its own",
      "optKeyEsc": "Close",
      "optKeyOpenTweet": "Open the post (in the same tab; going back restores your spot)",
      "optKeyOpenMedia": "Open the author's page (destination is chosen in Display settings above)",
      "optKeyLike": "Like",
      "optKeyBookmark": "Bookmark",
      "optKeyReply": "Reply (opens X's reply composer in place; you type and send it yourself as usual)",
      "optKeyRetweet": "Repost / undo (a plain repost, not a quote; to quote, open the tweet first)",
      "optKeyRefresh": "Refresh Home (\"For you\" tab only)",
      "optKeyProfileToMedia": "On a profile page, go to that account's media page",
      "optKeyNotInterested": "Open the \"•••\" menu of the hovered post (while it is open: move within the menu with the up/down keys (default W/S), select with Space, close with the open/close key (default Q))",
      "optKeyGoHome": "Go back to Home (no new tab; same as clicking the real Home icon in the same tab)",
      "optResetKeys": "Reset key bindings to defaults",
      "optNoteFixed": "Space, Esc and the arrow keys are fixed. Everything else is saved automatically when you type a single character into the fields above (duplicates are not allowed).",
      "optNoteBlank1": "For keys other than the five movement/open-close keys, ",
      "optNoteBlank2": "leaving the field blank means \"no key assigned\"",
      "optNoteBlank3": " and that feature will no longer respond to any key (e.g. to prevent accidental reposts if you never repost).",
      "optAboutBadge": "About this extension",
      "optAboutIntro": "This extension turns X (formerly Twitter) media, likes, bookmarks and Home into a grid of images you can browse quickly with the keyboard alone. Liking, bookmarking, following and more take a single key. The main features, in order of importance:",
      "optFeat1H": "1. Grid view",
      "optFeat1a": "Converts media pages, your likes history, bookmarks and Home (with \"Images only\" on) into a Pinterest-style image grid.",
      "optFeat1b": "Move the selection with W/A/S/D (or the arrow keys), open/close with Q, and use Space to scroll a screenful or zoom an image.",
      "optFeat1c": "The number of grid columns can be changed from the toolbar.",
      "optFeat2H": "2. Images only",
      "optFeat2a": "On Home and Bookmarks, a button toggles whether posts without images are filtered out and the rest shown as a grid.",
      "optFeat2b": "Home remembers this per tab (\"For you\", \"Following\", ...), separately from Bookmarks.",
      "optFeat3H": "3. Multi-image posts",
      "optFeat3a": "Click (or press Q) to see every image in the post laid out large from the start. Space enlarges one image further; A/D steps through them.",
      "optFeat4H": "4. Unread-only and videos-only filters",
      "optFeat4a": "Buttons in the grid narrow it down to only posts you haven't seen, or only video posts.",
      "optFeat5H": "5. \"Photos\" / \"Videos\" switch on media pages",
      "optFeat5a": "Media pages open with photos by default, and a button at the top switches to a videos-only view.",
      "optFeat6H": "6. Profile card",
      "optFeat6a": "A small card with the avatar, name, bio, follow counts and a follow button is shown at the top of media pages.",
      "optFeat7H": "7. Keyboard shortcuts (remappable)",
      "optFeat7a": "Open a post, open the author's media page, like, bookmark, refresh Home, open the menu, or go back to Home — each with a single key.",
      "optFeat7b": "Even on the normal timeline (without the grid), WASDQ selects posts for the same operations.",
      "optFeat8H": "8. Other",
      "optFeat8a": "The right sidebar can also be shown or hidden (see the settings on the left).",
      "optErrRequired": "$1 is a required movement/open-close key and cannot be left blank",
      "optErrSpace": "Space cannot be assigned because it conflicts with the fixed scroll action",
      "optErrDuplicate": "\"$1\" is used by both $2 and $3",
      "optFTargetLabel": "Destination of the author-page key (F)",
      "optFTargetProfile": "Profile (posts)",
      "optFTargetMedia": "Media tab (photos)",
      "optFTargetDesc": "Default: profile. Choose \"Media tab\" to jump straight to their photos.",
      "optAccentLabel": "Accent color",
      "optAccentDesc": "Default: X's blue. Changes the selection outline, tab underline, buttons, and other accents at once.",
      "optSeenColorLabel": "Seen color",
      "optSeenColorDesc": "Posts you've already seen get this color on the strip under the tile (a marker of how far you've read; recorded when you refresh or navigate away). Default is a theme-matched blue.",
      "optColorReset": "Reset",
      "extName": "X Media Grid",
      "bannerNewPosts": "Show new posts",
      "optNewPostsBannerLabel": "Show the \"new posts\" banner on the grid",
      "optNewPostsBannerDesc": "Default: on. While the home grid is active, a banner appears when new posts arrive; click to load them.",
      "optHideHomeDotLabel": "Hide the blue unread dot on Home",
      "optHideHomeDotDesc": "Default: off (shown). Hides the small blue dot on the Home icon in the left nav.",
      "optHideNotifBadgeLabel": "Hide the notification count badge",
      "optHideNotifBadgeDesc": "Default: off (shown). For people who already get browser notifications: hides the number badge on the Notifications icon."
    }
  };
  function xmrUiLang() {
    const l = (document.documentElement.lang || '').toLowerCase();
    return l.indexOf('ja') === 0 ? 'ja' : 'en';
  }
  function t(key, subs) {
    const table = I18N_TABLES[xmrUiLang()];
    let m = (table && table[key]) || I18N_TABLES.ja[key] || '';
    if (m && subs !== undefined) {
      const arr = Array.isArray(subs) ? subs : [subs];
      for (let i = arr.length - 1; i >= 0; i--) {
        m = m.split('$' + (i + 1)).join(String(arr[i]));
      }
    }
    return m || key;
  }

  // ---- 設定（キーはここで変更可能） ----
  const CONFIG = {
    // 興味がないキーは今はSettings.keys.notInterested（options.htmlでリマップ可能）を使う
    gridCols: 3,             // メディアグリッドの列数のデフォルト。配布視点の実機
                             // フィードバックで「サイドバーを隠さない標準状態なら
                             // 3列が自然」となり5→3に変更（開発初期はapp.htmlの5）。
                             // ユーザーが変更した値はlocalStorageに保存され次回も使われる
    subGridCols: 2,          // 複数画像ツイートのサブグリッド列数
    gridGap: 4,
    initialFillCount: 30,    // グリッド表示開始時に先読みしておく件数
    pumpBatchCount: 24,      // スクロールで下に近づくたびに追加で狙う件数
    photoPendingMs: 4000,    // 画像がまだ描画されていないセルを「本当に画像なし」と確定するまで待つ時間
    pumpStepMinWaitMs: 100,  // pumpMoreのスクロール1回ごとの最低待ち（Xがセルをマウントする猶予。攻めすぎると取りこぼす）
    pumpStepMaxWaitMs: 300,  // 新セルが来ない時の上限（従来の固定sleep(300)相当のフォールバック）
    seenStorageKey: 'xmr-seen-tweets',
    seenCap: 20000,          // 既読リストの保持上限（無制限に増え続けないように古い方から間引く）
    spaceHoldScrollPxPerSec: 1000, // Space長押し中の一定スクロール速度（単押しの滑らかスクロールの中間くらいを目安）
  };
  // 列数はユーザーが変更したら記憶する（実機フィードバック：設定が毎回
  // リセットされるのは不便、の一環）
  try {
    const savedCols = parseInt(localStorage.getItem('xmr-grid-cols'), 10);
    if (savedCols >= 1 && savedCols <= 10) CONFIG.gridCols = savedCols;
  } catch (e) {}

  // ---- 拡張機能の設定（options.htmlで変更可能） ----
  // content.js(このファイル)とoptions.htmlは別オリジン扱いでlocalStorageを
  // 共有できないため、拡張機能全体で共有できるchrome.storage.localを使う。
  // 読み込みは非同期なので、設定ページで変更してもこのタブでは
  // chrome.storage.onChangedが届くまでは古い値のまま（デフォルト値）で動く。
  // keys: Space/Esc/矢印キーは固定（Spaceは入力欄で表現しにくく、Esc/矢印は
  // 普遍的な期待動作のため）。それ以外の移動(WASD)・開閉(Q)・単発アクション
  // キー(R/F/2/3/C/X/G等)はoptions.htmlでリマップ可能。
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
    notInterested: 'x',
    profileToMedia: 'g',
    goHome: '1',
  };
  // hideSidebarの初期値はfalse（サイドバーは隠さない＝そのまま全部表示）。
  // tileActionsの初期値はtrue（タイルにマウスを乗せた時のいいね等のボタンを出す）。
  // fTarget: Fキー（投稿者ページ）の行き先。'profile'=プロフィール（ポスト
  // 一覧）/'media'=メディア欄。配布を見据えたフィードバック「まずアカウント
  // に飛びたい人の方が多いはず」を受けてデフォルトはprofile（メディア欄派は
  // 設定で切替）。
  const Settings = {
    hideSidebar: false,
    tileActions: true,
    fTarget: 'profile',
    accentColor: '', // ''=既定（Xブランド青）。#rrggbbでアクセント色を一括変更
    seenColor: '', // ''=既定（テーマ別の青系）。#rrggbbで既読の帯色を変更
    newPostsBanner: true, // グリッド上の「新しいポストを表示」バナー
    hideHomeDot: false, // ホームアイコンの青い未読ドットを隠す
    hideNotifBadge: false, // 通知アイコンの数字バッジを隠す
    keys: Object.assign({}, DEFAULT_KEYS),
  };

  // 設定のカスタム色をCSS変数へ反映する（htmlのインラインstyleに入れるので
  // テーマ別のデフォルト定義より常に優先される）。
  function applyCustomColors() {
    const rootStyle = document.documentElement && document.documentElement.style;
    if (!rootStyle) return;
    if (/^#[0-9a-fA-F]{6}$/.test(Settings.accentColor)) {
      const h = Settings.accentColor;
      rootStyle.setProperty(
        '--xmr-accent-rgb',
        parseInt(h.slice(1, 3), 16) + ', ' + parseInt(h.slice(3, 5), 16) + ', ' + parseInt(h.slice(5, 7), 16)
      );
    } else {
      rootStyle.removeProperty('--xmr-accent-rgb');
    }
    if (/^#[0-9a-fA-F]{6}$/.test(Settings.seenColor)) {
      rootStyle.setProperty('--xmr-seen-band', Settings.seenColor);
      rootStyle.setProperty('--xmr-seen-band-empty', Settings.seenColor);
    } else {
      rootStyle.removeProperty('--xmr-seen-band');
      rootStyle.removeProperty('--xmr-seen-band-empty');
    }
  }
  // ナビのバッジ類の表示設定をhtmlクラスへ反映（CSS側で隠す。バッジ要素は
  // 実機DOM観測で確定：ナビリンク内のsvgの後ろにあるdivがバッジ本体）
  function applyNavBadgePrefs() {
    if (!document.documentElement) return;
    document.documentElement.classList.toggle('xmr-hide-home-dot', Settings.hideHomeDot);
    document.documentElement.classList.toggle('xmr-hide-notif-badge', Settings.hideNotifBadge);
  }

  function applyTileActionsVisibility() {
    // display:noneの出し分けはCSS任せにして、ここではルート要素のクラスを
    // 切り替えるだけ（既存タイル・今後作るタイルの両方へ即時反映される）。
    if (document.documentElement) {
      document.documentElement.classList.toggle('xmr-tile-actions-off', !Settings.tileActions);
    }
  }
  function applySavedSettings(saved) {
    if (!saved) return;
    if (typeof saved.hideSidebar === 'boolean') Settings.hideSidebar = saved.hideSidebar;
    if (typeof saved.tileActions === 'boolean') Settings.tileActions = saved.tileActions;
    if (typeof saved.newPostsBanner === 'boolean') Settings.newPostsBanner = saved.newPostsBanner;
    if (typeof saved.hideHomeDot === 'boolean') Settings.hideHomeDot = saved.hideHomeDot;
    if (typeof saved.hideNotifBadge === 'boolean') Settings.hideNotifBadge = saved.hideNotifBadge;
    applyNavBadgePrefs();
    if (saved.fTarget === 'media' || saved.fTarget === 'profile') Settings.fTarget = saved.fTarget;
    if (typeof saved.accentColor === 'string') Settings.accentColor = saved.accentColor;
    if (typeof saved.seenColor === 'string') Settings.seenColor = saved.seenColor;
    applyCustomColors();
    if (saved.keys) Object.assign(Settings.keys, saved.keys);
    applyTileActionsVisibility();
  }
  try {
    chrome.storage.local.get(['xmr-settings'], (res) => {
      applySavedSettings(res && res['xmr-settings']);
    });
    // 設定ページ(options.html)はXの外にあるため<html lang>を見られない。
    // こちらで観測したXの表示言語を共有ストレージに記録しておき、設定
    // ページはそれを読んで同じ言語で表示する（「Xは英語なのに設定だけ
    // 日本語」を避けるため。実機フィードバックによる方針）。
    chrome.storage.local.set({ 'xmr-x-lang': xmrUiLang() });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes['xmr-settings']) {
        const oldV = changes['xmr-settings'].oldValue || {};
        const newV = changes['xmr-settings'].newValue || {};
        applySavedSettings(newV);
        // 設定ページで変更されても、既に表示中のグリッドへその場で反映する。
        // hideSidebarの切替は幅・検索ボタンの有無などUI構成そのものが
        // 変わるため、部分的なパッチではなくグリッドを張り替える（実機
        // 報告：ONに切り替えた直後だけUIが崩れていた。キャッシュ復元が
        // あるので張り替えは一瞬で、位置も保たれる）。
        if (Grid.active) {
          if (oldV.hideSidebar !== newV.hideSidebar) {
            const m = Grid.mode;
            deactivateGrid();
            activateGrid(m === 'home' ? 'home' : m);
          } else {
            applySidebarVisibility();
          }
        }
      }
    });
  } catch (e) {
    // chrome.storageが使えない環境でも表示専用の主要機能は動き続けるようにしておく
  }

  // ============================================================
  // 既読トラッキング：どこまで見たか覚えておき、タイルの文字を少し青みがからせる
  // ============================================================
  let seenTweets = null; // Set<tweetId>（localStorageから遅延ロード）
  function loadSeenTweets() {
    if (seenTweets) return seenTweets;
    try {
      const raw = localStorage.getItem(CONFIG.seenStorageKey);
      seenTweets = raw ? new Set(JSON.parse(raw)) : new Set();
    } catch (e) {
      seenTweets = new Set();
    }
    return seenTweets;
  }
  let seenSaveTimer = null;
  function saveSeenTweetsNow() {
    try {
      let arr = [...loadSeenTweets()];
      // Setは挿入順を保つので、古いもの（＝先に見たもの）から間引く
      if (arr.length > CONFIG.seenCap) arr = arr.slice(arr.length - CONFIG.seenCap);
      seenTweets = new Set(arr);
      localStorage.setItem(CONFIG.seenStorageKey, JSON.stringify(arr));
    } catch (e) {
      // 容量超過等は無視（既読トラッキングは無くても致命的ではない）
    }
  }
  function saveSeenTweetsSoon() {
    if (seenSaveTimer) return;
    seenSaveTimer = setTimeout(() => {
      seenSaveTimer = null;
      saveSeenTweetsNow();
    }, 2000);
  }
  // tryResyncReload()でページをリロードする直前に呼ぶ：2秒デバウンス待ちの
  // 既読追加分が未保存のままリロードで消えるのを防ぐ。
  function flushSeenTweetsNow() {
    if (!seenSaveTimer) return;
    clearTimeout(seenSaveTimer);
    seenSaveTimer = null;
    saveSeenTweetsNow();
  }
  function tweetIdFromHref(href) {
    const m = href && href.match(/\/status\/(\d+)/);
    return m ? m[1] : null;
  }

  // ============================================================
  // ユーティリティ
  // ============================================================
  function isTypingTarget(el) {
    if (!el) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
  }

  function waitFor(checkFn, timeoutMs, intervalMs) {
    return new Promise((resolve) => {
      const start = Date.now();
      const t = setInterval(() => {
        const v = checkFn();
        if (v) {
          clearInterval(t);
          resolve(v);
        } else if (Date.now() - start > timeoutMs) {
          clearInterval(t);
          resolve(null);
        }
      }, intervalMs || 30);
    });
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // window.scrollTo()だけではXの仮想リストが確実に再同期しないことが
  // 実機で確認された（scrollYは0になるのに表示位置がズレたまま）。
  // 以前はchrome.debugger(CDP)経由の擬似ホイール入力で再同期を試みていたが、
  // 実機で「message port closed」で時々失敗する・効果自体も未確認のままで、
  // 一方「本物のリロード」は確実に直ると実機確定済み。debugger権限を丸ごと
  // 削除し、最終手段をリロード一本に統一した（v3.45.0）。
  // 無限リロードループ防止：同一hrefへの再同期リロードはタブごと
  // (sessionStorage)に5分に1回まで。#xmr-fresh経由のリロードも同じキーに
  // 記録するので、Fキー直後の二重リロードも起きない。
  const RESYNC_RELOAD_KEY = 'xmr-resync-reload';
  const RESYNC_RELOAD_TTL_MS = 5 * 60 * 1000;
  function markResyncReload() {
    try {
      sessionStorage.setItem(RESYNC_RELOAD_KEY, JSON.stringify({ href: location.href, at: Date.now() }));
    } catch (e) {}
  }
  function tryResyncReload() {
    try {
      const rec = JSON.parse(sessionStorage.getItem(RESYNC_RELOAD_KEY) || 'null');
      if (rec && rec.href === location.href && Date.now() - rec.at < RESYNC_RELOAD_TTL_MS) return false;
    } catch (e) {
      return false; // sessionStorageが読めない環境では安全側＝リロードしない
    }
    markResyncReload();
    flushSeenTweetsNow(); // 2秒デバウンス待ちの既読データを先に確定させる
    location.reload();
    return true;
  }

  function onUrlChange(cb) {
    // cb()内で想定外の例外が起きても（document_start直後でdocument.bodyが
    // まだ無い等）、それがこの関数の外へ伝播すると、呼び出し元でこの後に
    // 続くはずの初期化コード（bodyObserverのセットアップ等）が丸ごと
    // 実行されなくなってしまう。個々の原因を都度潰すより、ここで一括して
    // 例外を握りつぶし、以後のcb呼び出しは正常に続けられるようにしておく。
    const safeCb = () => {
      try {
        cb();
      } catch (err) {
        console.error('[X Media Grid Restore] onNavigate failed:', err);
      }
    };
    let last = location.href;
    const fire = () => {
      if (location.href !== last) {
        last = location.href;
        safeCb();
      }
    };
    window.addEventListener('popstate', fire);
    // X はタイトルをルート遷移のたびに書き換えるので、それを検知トリガーにする
    const titleObserver = new MutationObserver(fire);
    const titleEl = document.querySelector('title');
    if (titleEl) titleObserver.observe(titleEl, { childList: true });
    // 保険のポーリング（軽量）
    setInterval(fire, 400);
    safeCb(); // 初回実行
  }

  // ============================================================
  // 機能1: 「•••」メニューをワンキーで開く
  // 以前はホバー中のポストでキーを押すと"..."メニューを開いて「興味が
  // ない」を自動クリックしていたが、ポストによってはそもそも「興味が
  // ない」の項目自体が無い（実機報告）。説明文とも実際の挙動ともズレて
  // いたため、キーの役割は「メニューを開く」だけにし、その後の選択操作は
  // W/S/Q/Spaceで行えるようにした（下のメニュー操作セクション）。
  // ============================================================
  let hoveredArticle = null;
  document.addEventListener(
    'mouseover',
    (e) => {
      const a = e.target.closest && e.target.closest('article');
      if (a) hoveredArticle = a;
    },
    true
  );

  // 実機確認：「•••」メニュー(role="menu")はArrowUp/ArrowDown/Escapeの
  // ネイティブなキーボード操作に対応しているが、それは信頼済み(isTrusted)の
  // 本物のキー入力の時だけだった。content scriptから送れる合成KeyboardEvent
  // (isTrusted=false)はArrowDown/Escapeどちらにも一切反応しないことを
  // 実機で確認済み（以前「反応する」としていたのは誤りだった。信頼済み
  // 入力での動作確認と混同していた）。一方、メニュー項目への.focus()と
  // .click()、およびメニューの外側（バックドロップ要素、メニューの兄弟
  // 要素のうちビューポートの大半を覆うもの）への.click()は合成イベントでも
  // 問題なく機能することを実機確認済み（このプロジェクトの他の「本物の
  // ボタンへclick()を委譲する」パターンと同じ）。そのためキー操作は
  // ネイティブのキーボードナビゲーションに頼らず、選択中の項目を自前で
  // 管理し、.focus()/.click()だけで実現する。
  const MenuNav = { items: [], index: -1 };

  // 実機報告：.focus()だけだと、初期位置からSを押した瞬間に枠線が消えて
  // どこを選択中か分からなくなる（4回押すと5番目に正しくフォーカスして
  // いるので、内部の選択位置自体は正しく動いている）。おそらくブラウザの
  // :focus-visible判定がプログラム的なfocus()には常に見た目のリングを
  // 出してくれるとは限らないため。ネイティブのfocusに頼らず、他のグリッド
  // 部分と同じ自前のCSSクラス(.xmr-menu-selected)で確実に見た目を出す。
  function menuNavHighlight() {
    MenuNav.items.forEach((el, i) => el.classList.toggle('xmr-menu-selected', i === MenuNav.index));
    const item = MenuNav.items[MenuNav.index];
    if (item) item.focus();
  }

  function findMenuBackdrop(menu) {
    const parent = menu.parentElement;
    if (!parent) return null;
    for (const kid of parent.children) {
      if (kid === menu) continue;
      const r = kid.getBoundingClientRect();
      if (r.width > window.innerWidth * 0.5 && r.height > window.innerHeight * 0.5) return kid;
    }
    return null;
  }

  async function openMoreMenu(article) {
    const caret = article.querySelector('[data-testid="caret"]');
    if (!caret) return;
    caret.click();
    const menu = await waitFor(() => document.querySelector('[role="menu"]'), 1500, 50);
    if (!menu) return;
    MenuNav.items = [...menu.querySelectorAll('[role="menuitem"]')];
    MenuNav.index = MenuNav.items.length > 0 ? 0 : -1;
    menuNavHighlight();
  }

  document.addEventListener('keydown', (e) => {
    if (isTypingTarget(e.target)) return;
    if (e.key.toLowerCase() !== Settings.keys.notInterested) return;
    // グリッドビューア内で使っている場合はそちらを優先（衝突回避）
    if (document.querySelector('.xmr-overlay.xmr-open')) return;
    if (document.querySelector('[role="menu"]')) return; // 既に開いていれば何もしない
    const target =
      hoveredArticle && document.contains(hoveredArticle)
        ? hoveredArticle
        : document.querySelector('[data-testid="primaryColumn"] article');
    if (!target) return;
    e.preventDefault();
    openMoreMenu(target);
  });

  // 「•••」メニューが開いている間だけ、W/Sで自前管理の選択位置を動かし
  // （.focus()でネイティブの見た目のハイライトも一致させる）、Spaceで
  // 選択中の項目を.click()、Qでメニュー外側（バックドロップ）を.click()して
  // 閉じる。captureフェーズ＋stopImmediatePropagation()で、グリッドや
  // 通常タイムラインのWASDQハンドラより先に横取りする。
  document.addEventListener(
    'keydown',
    (e) => {
      const menu = document.querySelector('[role="menu"]');
      if (!menu) return;
      if (isTypingTarget(e.target)) return;
      const k = e.key.toLowerCase();
      if (k === Settings.keys.moveUp || e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (MenuNav.items.length > 0) {
          MenuNav.index = (MenuNav.index - 1 + MenuNav.items.length) % MenuNav.items.length;
          menuNavHighlight();
        }
      } else if (k === Settings.keys.moveDown || e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (MenuNav.items.length > 0) {
          MenuNav.index = (MenuNav.index + 1) % MenuNav.items.length;
          menuNavHighlight();
        }
      } else if (k === Settings.keys.openClose || e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        const backdrop = findMenuBackdrop(menu);
        if (backdrop) backdrop.click();
      } else if (e.key === ' ') {
        e.preventDefault();
        e.stopImmediatePropagation();
        const item = MenuNav.items[MenuNav.index];
        if (item) item.click();
      }
    },
    true
  );

  // ============================================================
  // 機能3（撤回済み）: 左ナビを小さくする
  //
  // ラベル文字(span)を隠すだけではナビ全体の幅は縮まなかった。実機調査で
  // 判明した理由: 各<a role="link">要素自体がflex-grow:1で259px前後まで
  // 広がっており、それを個別にwidth:auto/flex-grow:0/align-self:flex-start
  // で86px前後まで縮めても、ナビ(header[role="banner"])自身の幅は335pxの
  // ままだった。さらに調べると、<a>とheaderの間に複数階層の無名ラッパーdiv
  // (自動生成クラス名、"ホーム 話題を検索 通知..."等をまとめて内包)がそれぞれ
  // 独立して古い幅を持っており、ナビの外側の幅はそれら全部を縮めない限り
  // 変わらないことが分かった。特定のセレクタに依存しない汎用的な縮小方法が
  // 見つからず、これ以上追いかけるとXのDOM変更に弱い脆いコードになるため、
  // 「文字を隠したのに幅だけ残る」という中途半端な状態を続けるより、
  // ナビ圧縮自体を撤回してXの標準表示に戻すことにした
  // （ユーザーからの「どちらかに決着させろ」という指示に基づく判断）。
  // ============================================================
  function widenMain() {
    // 現在は何もしない。通常ページ(home/post等)はXの標準レイアウトのまま。
    // グリッド専用ページ(media/likes/bookmarks)は独立したposition:fixed
    // オーバーレイなので、この関数の内容とは無関係に正常に動作する。
  }

  // ============================================================
  // 機能4: /media を開いたら自動的に ?filter=photo にする
  //
  // 前回「動画も見たい」との要望を受けてこの自動リダイレクトを一度撤回した
  // が、それは誤りだった。実機で確認し直したところ、Xの/mediaは「画像と
  // 動画が混ざって出る」のではなく、**フィルタ無し(bare /media)=動画のみ、
  // ?filter=photo=画像のみ**という、常にどちらか片方しか出ない仕様
  // だった（タブの表示も「動画」⇔「画像」で動的に切り替わり、常に片方
  // だけが見えるようになっている）。つまりフィルタを外したことで「画像の
  // 隣に動画も」ではなく「画像が消えて動画だけ」になっていた（実機報告で
  // 発覚）。メディアを開いたら画像側をデフォルトにしてほしいというのが
  // そもそもの最初からの要望だったため、?filter=photoへの自動リダイレクトを
  // 復活させる。動画を見たい時は下のextraTabsに「動画」ピルを別途用意する
  // （画像/動画を両方常にクリックできるようにする。activateGrid参照）。
  // ============================================================
  // 「動画」ピルをクリックした時（下のactivateGrid内）は、あえてフィルタ
  // 無しのbare /mediaへ移動したい。だがそのままだとこの自動リダイレクトが
  // 即座に?filter=photoへ引き戻してしまうため、直後の1回だけ抑制するフラグ。
  let suppressNextPhotoRedirect = false;
  function autoRedirectMediaPhoto() {
    const m = location.pathname.match(/^\/[^/]+\/media\/?$/);
    if (!m) return;
    if (location.search) return; // 既にフィルタ指定済みなら尊重する
    if (suppressNextPhotoRedirect) {
      suppressNextPhotoRedirect = false;
      return;
    }
    const newUrl = location.pathname.replace(/\/$/, '') + '?filter=photo';
    history.replaceState(history.state, '', newUrl);
    window.dispatchEvent(new PopStateEvent('popstate', { state: history.state }));
  }

  // ============================================================
  // 機能5: メディアタブ／いいね欄をグリッド化 + WASD/Q ビューア
  //
  // 設計方針（v2）：Xの仮想スクロールDOMの位置(transform)は一切書き換えない。
  // 元のリストは裏で完全に普段どおり動かしたまま透明化するだけにして、
  // そこから画像/テキストを抽出し、まったく別物の自前グリッドとして
  // 描画する。グリッドが下に近づいたら「裏のリスト」を自分でスクロール
  // させてXの読み込みを誘発し、増えた分だけ拾ってグリッドに足す。
  // ============================================================
  const Grid = {
    active: false,
    mode: null, // 'media' | 'likes'
    activeHref: null, // activateGrid()が最後に処理したlocation.href（同じmodeでもURLが変われば再アクティブ化するため）
    sourceRoot: null, // Xの本物のリストのコンテナ（見た目だけ透明化。位置は触らない）
    shellResizeHandler: null,
    seen: null, // Set<key>
    pending: null, // Map<key, firstSeenTimestamp> 画像がまだ描画されていないセルの保留リスト
    pendingTimer: null,
    entries: [], // {type:'photo'|'text', href, images:[], avatar, name, text, tileEl}
    shellEl: null,
    gridEl: null,
    loadingEl: null,
    refreshStatusEl: null, // 更新中インジケータ（ツールバーに常設、スクロール位置に関係なく見える）
    level: 'grid', // 'grid' | 'sub' | 'subview' | 'view'
    selIndex: 0,
    maxSeenIndex: -1, // WASD等で実際に到達した最大インデックス（既読の区切りに使う）
    subImages: [],
    subSelIndex: 0,
    subEntry: null, // サブグリッドを開いたときの元エントリ（Enter遷移用にhrefを保持）
    viewList: [], // 画像ビューア用の平坦なリスト（entryオブジェクトの配列。テキストのみのエントリは除外）
    viewIndex: 0,
    viewImageIndex: 0, // viewList[viewIndex]が複数画像を持つ場合、その中の何枚目か
    overlay: null,
    sourceObserver: null,
    pumping: false,
    refreshing: false, // refreshHomeTimeline()実行中かどうか（多重起動防止）
    navToken: 0, // ページ遷移のたびに増やして、古い非同期処理を打ち切るためのトークン
    filterUnread: false, // 「未読のみ表示」トグル（永続化はせず、活性化のたびOFFから始まる）
    filterVideoOnly: false, // 「動画のみ表示」トグル（同上）
    sidebarPeekOpen: false, // 検索ボタンで一時的にサイドバーを表示している間だけtrue（永続化しない）
    userHasNavigated: false, // WASD/A/D/Spaceで意図的に操作したらtrue（初回読み込み完了時の並び替えをスキップするかの判定に使う。マウススクロール追従では立てない）
    activatingMode: null, // activateGrid()が完了(Grid.active=true)するまでの間、要求中のmodeを保持（同じ目的の重複呼び出しを弾くため）
    activatingHref: null,
    homeScope: null, // ホームのどのタブでこのグリッドを作ったか（タブ切替の検知とキャッシュキーに使う）
    newPostsTimer: null, // 新着ピル(pillLabel)の監視タイマー（ホームのみ）
    newPostsBtn: null, // グリッド上の「新しいポストを表示」バナー要素
    veilEl: null, // キャッシュ復元の間、素のページが一瞬見えるのを隠す幕
  };

  function isPhotoMediaPage() {
    // 以前は?filter=photoが付いている時だけ対象にしていたが、そのフィルタ
    // 自体を撤回した（動画を除外してしまうため）。クエリの有無に関わらず
    // /username/mediaならメディア欄として扱う。
    return /^\/[^/]+\/media\/?$/.test(location.pathname);
  }

  function isLikesPage() {
    return /^\/i\/history\/likes\/?$/.test(location.pathname);
  }

  function isBookmarksPage() {
    // Xの仕様変更で/i/bookmarksへのアクセスが/i/history（「いいね」との
    // タブ切替UI、ブックマークがデフォルト選択）へ自動リダイレクトされる
    // ようになった（実機確認）。旧URL(/i/bookmarks)がまだ生きている環境も
    // あるかもしれないので両方を対象にする。/i/history/likes（いいね側の
    // タブ）はisLikesPage()の担当なのでここではマッチさせない。
    return /^\/i\/(bookmarks|history)\/?$/.test(location.pathname);
  }

  function isHomePage() {
    return location.pathname === '/home';
  }

  // ワード検索結果の「メディア」タブ（/search?q=…&f=media）。
  // 検索結果もイラスト探しの主要な入口なのにグリッド化の対象外だった、
  // という指摘を受けて追加。f=mediaの時だけ対象（話題のポスト/最新/
  // アカウント等の他タブは通常表示のまま）。
  function isSearchMediaPage() {
    if (location.pathname !== '/search') return false;
    try {
      return new URLSearchParams(location.search).get('f') === 'media';
    } catch (e) {
      return false;
    }
  }

  // 「画像のみ表示」は実験的機能。当初はホーム全体で1つのON/OFFだけだったが、
  // ホームのタブ(おすすめ/フォロー中/自分で作ったリスト)ごとに別々に覚えて
  // ほしい、ブックマークにも同じON/OFFが欲しい、という要望を受けて汎用化した。
  // 「どこの設定か」を表す文字列(scope)ごとにlocalStorageへ保存する。
  //   home:おすすめ / home:フォロー中 / home:(自作リスト名) / bookmarks
  function imageOnlyStorageKey(scope) {
    return 'xmr-image-only:' + scope;
  }
  function getImageOnly(scope) {
    if (!scope) return false;
    const raw = localStorage.getItem(imageOnlyStorageKey(scope));
    if (raw !== null) return raw === '1';
    // 移行: v3.50以前はホームのタブ表示文言（日本語）をキーにしていたため、
    // 位置ベースの新キー(tab0/tab1)が未保存なら旧日本語キーを読む。さらに
    // 旧々バージョン（ホーム全体で1フラグ）のキーにもフォールバックする。
    if (scope === 'home:tab0') {
      const oldJa = localStorage.getItem('xmr-image-only:home:おすすめ');
      if (oldJa !== null) return oldJa === '1';
      const legacy = localStorage.getItem('xmr-home-image-only');
      if (legacy !== null) return legacy === '1';
    }
    if (scope === 'home:tab1') {
      const oldJa = localStorage.getItem('xmr-image-only:home:フォロー中');
      if (oldJa !== null) return oldJa === '1';
    }
    // いいね／ブックマーク／メディア欄は元々トグルが無く常にON扱いだったので、
    // 初期値はONにして移行前と見え方を変えない。検索メディアも「画像を
    // 見たくて開くタブ」なので初期値ON。
    if (scope === 'bookmarks' || scope === 'media' || scope === 'likes' || scope === 'search') return true;
    return false;
  }
  function setImageOnly(scope, value) {
    if (!scope) return;
    localStorage.setItem(imageOnlyStorageKey(scope), value ? '1' : '0');
  }

  // 「未読のみ表示」「動画のみ表示」の記憶。実機フィードバックを受けて
  // 2段階で変わった：①毎回OFFに戻る→永続化（v3.53）②全ページ共通だと
  // ホームとメディア欄で同じ設定が強制される→場所ごと（画像のみ表示と
  // 同じscope単位）に個別記憶（v3.56）。旧・共通キーは初回の移行元として
  // だけ読む。
  function filterStorageKey(base) {
    return base + ':' + (currentImageOnlyScope() || 'global');
  }
  function readFilterSetting(base) {
    try {
      const v = localStorage.getItem(filterStorageKey(base));
      if (v !== null) return v === '1';
      const legacy = localStorage.getItem(base); // v3.53〜55の全体共通キー
      return legacy === '1';
    } catch (e) {
      return false;
    }
  }
  function writeFilterSetting(base, value) {
    try {
      localStorage.setItem(filterStorageKey(base), value ? '1' : '0');
    } catch (e) {}
  }

  // ホームのタブ(おすすめ/フォロー中/自分で作ったリスト等)は/homeのままURLが
  // 変わらずSPA内で切り替わる（実機確認：aria-selectedが同じ<button>群の上で
  // 付け替わるだけ、要素自体は再利用される）。
  function currentHomeTabText() {
    // 表示用：選択中タブの表示文字列（トグルボタンのラベルにだけ使う）
    const tablist = document.querySelector('[data-testid="primaryColumn"] [role="tablist"]');
    if (!tablist) return 'おすすめ'; // タブがまだ無ければ従来通り(おすすめ相当)として扱う
    const selected = tablist.querySelector('[role="tab"][aria-selected="true"]');
    return selected ? selected.textContent.trim() : 'おすすめ';
  }

  // 設定キー用のscope：Xの表示言語に依存しない識別子。先頭2タブ
  // （おすすめ/フォロー中に相当。英語UIでは"For you"/"Following"）は位置で
  // 'tab0'/'tab1'に固定し、3番目以降（ピン留めした自作リスト）はリスト名
  // そのもの（リスト名はUI言語を変えても同じ文字列）を使う。以前はタブの
  // 表示文言をそのままキーにしていたため、Xの表示言語を変えると全タブの
  // ON/OFF設定が別キー扱いになりリセットされる問題があった。
  // ※「先頭2タブが常におすすめ/フォロー中の順」は日本語UIの実機で確認済み。
  //   他言語UIでの並びは未検証（同じはずだが要確認）。
  function currentHomeTabScope() {
    const tablist = document.querySelector('[data-testid="primaryColumn"] [role="tablist"]');
    if (!tablist) return 'tab0';
    const tabs = [...tablist.querySelectorAll('[role="tab"]')];
    const idx = tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true');
    if (idx < 0) return 'tab0';
    if (idx <= 1) return 'tab' + idx;
    return tabs[idx].textContent.trim();
  }

  // 現在のページが「画像のみ表示」トグルの対象かどうか、対象なら区別用の
  // scope文字列を返す（対象外のページ＝トグル自体を出さないページはnull）。
  function currentImageOnlyScope() {
    if (isHomePage()) return 'home:' + currentHomeTabScope();
    if (isBookmarksPage()) return 'bookmarks';
    if (isLikesPage()) return 'likes';
    if (isPhotoMediaPage()) return 'media';
    if (isSearchMediaPage()) return 'search';
    return null;
  }

  function currentGridMode() {
    // メディア欄にも画像のみ表示のON/OFFを付けてほしいとの要望。OFFの時は
    // 自動リダイレクト(?filter=photo)自体は元々の機能として残し、グリッド
    // 化だけをしない（＝普段通りのXの表示）。いいねの履歴も元々トグルが
    // 無く常時ONだったが、ブックマーク同様にON/OFF切り替えたいとの要望を
    // 受けて他と同じ仕組みに揃えた。
    if (isPhotoMediaPage()) return getImageOnly('media') ? 'media' : null;
    if (isLikesPage()) return getImageOnly('likes') ? 'likes' : null;
    if (isBookmarksPage()) return getImageOnly('bookmarks') ? 'likes' : null;
    if (isHomePage()) return getImageOnly(currentImageOnlyScope()) ? 'home' : null;
    // 検索メディアは専用mode 'search'。メディア欄(media)特有の処理
    // （プロフィールカード・?filter=photoリダイレクト・画像/動画ピル）や
    // likes特有の処理（テキストのみ投稿もタイル化）を一切踏まない、
    // 素のグリッドとして動く。
    if (isSearchMediaPage()) return getImageOnly('search') ? 'search' : null;
    return null;
  }

  // ホームのタブ切替はURLが変わらないため、通常のonUrlChange(URL監視)では
  // 検知できない。タブ一覧(role="tablist")のaria-selected属性の変化だけを
  // 狙って監視する専用のMutationObserverを別途用意する（body全体を見る
  // bodyObserverでやると、タイムラインの頻繁な描画更新のたびに毎回
  // currentGridMode()を再評価することになり無駄が大きいため）。
  let homeTabObserver = null;
  let homeTabObserverTarget = null;
  async function ensureHomeTabObserver() {
    if (!isHomePage()) {
      if (homeTabObserver) {
        homeTabObserver.disconnect();
        homeTabObserver = null;
        homeTabObserverTarget = null;
      }
      return;
    }
    let tablist = document.querySelector('[data-testid="primaryColumn"] [role="tablist"]');
    if (!tablist) {
      // 実機報告：他のページからホームへ戻った直後、画像のみ表示がONの
      // はずなのにグリッド化されず、更新等の別操作をして初めて反映される
      // ことがあった。onNavigate()が呼ばれた瞬間にはまだXがホームの
      // タブ一覧を描画し終えていないタイミングがあり、この関数がタブ一覧を
      // 見つけられないまま即returnしていたのが原因と考えられる。少し
      // 待って再度探す。
      tablist = await waitFor(() => document.querySelector('[data-testid="primaryColumn"] [role="tablist"]'), 3000, 100);
      if (!isHomePage() || !tablist) return; // 待っている間に他ページへ移動していたら何もしない
    }
    if (tablist === homeTabObserverTarget) return;
    if (homeTabObserver) homeTabObserver.disconnect();
    homeTabObserverTarget = tablist;
    homeTabObserver = new MutationObserver(() => {
      const scope = currentImageOnlyScope();
      const shouldBeGrid = getImageOnly(scope);
      if (shouldBeGrid && (!Grid.active || Grid.mode !== 'home')) {
        activateGrid('home');
      } else if (!shouldBeGrid && Grid.active && Grid.mode === 'home') {
        deactivateGrid();
      } else if (shouldBeGrid && Grid.active && Grid.mode === 'home' && scope !== Grid.homeScope) {
        // 【実機報告のバグ修正】切替元・切替先の両タブが画像のみ表示ONだと、
        // URLも(mode==='home'のまま)変わらないため再活性化が一切走らず、
        // 前のタブの内容が表示され続けていた。activateGrid側のスコープ
        // 一致判定により、この呼び出しで旧グリッド解除→新タブで再構築
        // される（旧タブはスコープ付きキーでスナップショットされるので、
        // 一度見たタブへの切替はキャッシュ復元で一瞬）。
        activateGrid('home');
      }
      refreshImageOnlyToggleLabel();
      updateHomeTabbarActive();
    });
    homeTabObserver.observe(tablist, { attributes: true, attributeFilter: ['aria-selected'], subtree: true });
    // タブ一覧が今見つかった直後に、現在あるべき状態を1回チェックする
    // （onNavigate()側のcurrentGridMode()判定が、タブ一覧未検出のまま
    // 先に走ってしまっていた場合の取りこぼしを防ぐ）。
    const scope = currentImageOnlyScope();
    const shouldBeGrid = getImageOnly(scope);
    if (shouldBeGrid && (!Grid.active || Grid.mode !== 'home')) {
      activateGrid('home');
    } else if (!shouldBeGrid && Grid.active && Grid.mode === 'home') {
      deactivateGrid();
    } else if (shouldBeGrid && Grid.active && Grid.mode === 'home' && scope !== Grid.homeScope) {
      // observer本体と同じ「タブが変わったのにグリッドが古いまま」対策
      activateGrid('home');
    }
  }

  // ホームのタブ切替（aria-selectedの付け替え）に合わせて、自前タブバーの
  // アクティブ下線を同期する。グリッドが張り替わらないケース（両タブとも
  // 画像のみ表示ONで同じグリッドが生き続ける等）でも下線だけ正しく動く。
  function updateHomeTabbarActive() {
    const tablist = document.querySelector('[data-testid="primaryColumn"] [role="tablist"]');
    if (!tablist || !Grid.shellEl) return;
    const tabs = [...tablist.querySelectorAll('[role="tab"]')];
    Grid.shellEl.querySelectorAll('.xmr-tabbar [data-xmr-home-idx]').forEach((btn) => {
      const i = parseInt(btn.dataset.xmrHomeIdx, 10);
      const on = !!(tabs[i] && tabs[i].getAttribute('aria-selected') === 'true');
      btn.classList.toggle('xmr-xtab-active', on);
    });
  }

  // ホーム／ブックマークに出す「画像のみ表示」トグルボタン。タブ/ページごとに
  // 別々のON/OFFを覚えるので、ボタン自体は共通の1つだが表示中のscopeに
  // 応じて表示・動作を切り替える。
  let imageOnlyToggleBtn = null;
  function imageOnlyToggleLabel(scope, on) {
    let name = t('scopeBookmarks');
    // ホームはscopeが位置ベース(tab0等)になったので、表示名は実際に選択
    // されているタブの文言をその場で取る（リスト名scopeはそのまま使える。
    // タブ名はXから取る動的値なのでt()は通さない）
    if (scope.startsWith('home:')) name = currentHomeTabText();
    else if (scope === 'media') name = t('scopeMedia');
    else if (scope === 'likes') name = t('scopeLikes');
    else if (scope === 'search') name = t('scopeSearch');
    return t('imageOnlyLabel', [name]) + ': ' + (on ? 'ON' : 'OFF');
  }
  function refreshImageOnlyToggleLabel() {
    if (!imageOnlyToggleBtn) return;
    const scope = currentImageOnlyScope();
    if (!scope) return;
    const label = imageOnlyToggleLabel(scope, getImageOnly(scope));
    // 重大バグ修正：ここが無条件に textContent へ書き込んでいたため、
    // 「同じ文字列」でも毎回DOM変更が発生し、それを document.body 全体を
    // 監視している bodyObserver が検知して ensureImageOnlyToggle() を
    // 呼び直し、そこから再びこの関数が呼ばれて…という無限ループになって
    // いた（実機報告：拡張機能導入後にXが完全に固まる／クラッシュしたように
    // 見える不具合の原因）。値が実際に変わる時だけ書き込むようにする。
    if (imageOnlyToggleBtn.textContent !== label) {
      imageOnlyToggleBtn.textContent = label;
    }
    // ONの間は色でも分かるようにする（classList.toggleは同値なら
    // attribute変更を発生させないので、bodyObserverループの心配はない）
    imageOnlyToggleBtn.classList.toggle('xmr-tb-on', getImageOnly(scope));
  }
  // 左下固定12pxのままだと自分のアカウントアイコン・ハンドル名の行と重なって
  // いた（実機報告：位置を90pxに上げても「まだ変」との再報告）。ナビの高さは
  // ズーム倍率やウィンドウサイズで変わるため固定オフセットは脆く、この
  // プロジェクトで何度も効果があった「Xのレイアウト計算に頼らず自分で実測
  // する」方式に変更する。アカウントスイッチャー要素の実際の位置を毎回測って、
  // その少し上に配置する。
  function positionImageOnlyToggle(btn) {
    const accountBtn = document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]');
    if (accountBtn) {
      const rect = accountBtn.getBoundingClientRect();
      if (rect.height > 0) {
        btn.style.bottom = Math.max(12, window.innerHeight - rect.top + 10) + 'px';
        return;
      }
    }
    btn.style.bottom = '90px'; // 測れない場合のフォールバック
  }

  function ensureImageOnlyToggle() {
    // run_at:document_start では document.body がまだ存在しないタイミングで
    // 呼ばれることがある。ここでappendChildが例外を投げると、呼び出し元の
    // onUrlChange(onNavigate)の初回同期呼び出しが丸ごと失敗し、その後に続く
    // bodyObserverのセットアップコードまで実行されなくなる不具合があった
    // （初回ロードが直接/homeだった場合に再現）。bodyが無ければ何もしない。
    if (!document.body) return;
    let existing = document.querySelector('.xmr-home-toggle');
    const scope = currentImageOnlyScope();
    if (!scope) {
      if (existing) existing.remove();
      imageOnlyToggleBtn = null;
      return;
    }
    if (!existing) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'xmr-home-toggle';
      btn.addEventListener('click', () => {
        const s = currentImageOnlyScope();
        if (!s) return;
        setImageOnly(s, !getImageOnly(s));
        refreshImageOnlyToggleLabel();
        onNavigate();
      });
      document.body.appendChild(btn);
      existing = btn;
    }
    imageOnlyToggleBtn = existing;
    refreshImageOnlyToggleLabel();
    // 実機フィードバック「左下フローティングの位置がださい」への対応：
    // グリッド表示中はツールバーのフィルタ群（未読のみ/動画のみの隣）に
    // 収め、グリッドOFF中（＝ONに戻すボタンが必要な時）だけ従来の左下
    // フローティングにする。自前要素なのでDOM上の移動は安全（設計原則7が
    // 禁じるのはXの本物の要素の移動）。親が同じなら何もしないので、
    // bodyObserver経由で何度呼ばれても追加のDOM変更は起きない（原則3）。
    const filterGroup = Grid.active && Grid.shellEl ? Grid.shellEl.querySelector('.xmr-tb-group-filter') : null;
    if (filterGroup) {
      if (existing.parentElement !== filterGroup) {
        filterGroup.appendChild(existing);
        existing.classList.add('xmr-home-toggle-toolbar');
        existing.style.bottom = '';
      }
    } else {
      if (existing.parentElement !== document.body) {
        document.body.appendChild(existing);
        existing.classList.remove('xmr-home-toggle-toolbar');
      }
      positionImageOnlyToggle(existing); // style変更はbodyObserver(childList監視)を発火させないので安全
    }
  }

  // --- ライトボックス（拡大表示）オーバーレイ：常設のポップアップ、DOM構造に依存しない自前要素 ---
  // ヒント文言はキーのリマップ（Settings.keys）を反映して動的に組み立てる。
  // オーバーレイは一度作ったら使い回すので、開くたび（ensureOverlay呼び出し
  // ごと）に最新のキー割り当てへ更新する。textContentへの書き込みは
  // bodyObserver（childList/subtree監視）を再発火させ得るため、値が実際に
  // 変わる時だけ書き込むこと（設計原則3）。
  function refreshOverlayHint(overlay) {
    const K = Settings.keys;
    const up = (s) => (s || '').toUpperCase();
    const hintText = t('overlayHint', [up(K.moveUp) + up(K.moveLeft) + up(K.moveDown) + up(K.moveRight), up(K.openClose)]);
    const hint = overlay.querySelector('.xmr-overlay-hint');
    if (hint && hint.textContent !== hintText) hint.textContent = hintText;
    const closeText = t('overlayCloseButton', [up(K.openClose)]);
    const closeBtn = overlay.querySelector('.xmr-overlay-close');
    if (closeBtn && closeBtn.textContent !== closeText) closeBtn.textContent = closeText;
  }
  function ensureOverlay() {
    if (Grid.overlay) {
      refreshOverlayHint(Grid.overlay);
      return Grid.overlay;
    }
    const overlay = document.createElement('div');
    overlay.className = 'xmr-overlay';
    overlay.innerHTML =
      '<div class="xmr-overlay-hint"></div>' +
      '<button class="xmr-overlay-close" type="button"></button>' +
      '<div class="xmr-overlay-body"></div>';
    refreshOverlayHint(overlay);
    document.body.appendChild(overlay);
    overlay.querySelector('.xmr-overlay-close').addEventListener('click', () => closeOverlayLevel());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeOverlayLevel();
    });
    Grid.overlay = overlay;
    return overlay;
  }

  function fullSrc(src) {
    if (!src) return src;
    return src.replace(/name=\w+/, 'name=large');
  }

  // グリッドのサムネはXが返す一番小さいsrc(name=small)をそのまま使っていたため
  // ぼやけて見えることがあった。もう一段階上のサイズに上げる。
  function mediumSrc(src) {
    if (!src) return src;
    return src.replace(/name=\w+/, 'name=medium');
  }

  // 投稿者アイコン・名前・本文・元ツイートを開くリンクをまとめたキャプション
  // パネルを作る。単一画像のビューア(renderViewer)・複数画像のサブグリッド
  // (renderSubgrid)の両方から使う共通部品（実機報告：単体画像では出るのに
  // 複数画像では投稿者名や「このポストを開く」リンクが一切出ないバグが
  // あった＝renderSubgridにはこの部分が最初から存在していなかった）。
  function buildViewerCaption(entry) {
    const caption = document.createElement('div');
    caption.className = 'xmr-viewer-caption';
    if (entry && (entry.name || entry.text)) {
      const head = document.createElement('div');
      head.className = 'xmr-tile-head';
      const avatar = document.createElement('img');
      avatar.className = 'xmr-tile-avatar';
      if (entry.avatar) avatar.src = entry.avatar;
      else avatar.style.display = 'none'; // アバター不明（検索メディア等）なら空の丸を出さない
      const name = document.createElement('span');
      name.className = 'xmr-tile-name';
      name.textContent = entry.name || '';
      head.appendChild(avatar);
      head.appendChild(name);
      // アイコン/名前のクリックでそのアカウントのページを新しいタブで開く
      // （タイルの帯のアバターと同じ挙動に揃える）
      const headAuthor = entry.href ? tweetAuthorFromHref(entry.href) : null;
      if (headAuthor) {
        head.classList.add('xmr-viewer-head-link');
        head.title = t('viewerOpenAuthorPage', [headAuthor]);
        head.addEventListener('click', (ev) => {
          ev.stopPropagation();
          xmrSpaNavigate('/' + headAuthor); // 同タブSPA遷移（速い・戻りで復元）
        });
      }
      caption.appendChild(head);
      // エンゲージメント数（リプ/リポスト/いいね/表示回数）。収穫時に裏の
      // セルから読み取った表示文字列をそのまま出す（言語・単位非依存）。
      const cts = entry.counts;
      if (cts && (cts.reply || cts.rt || cts.like || cts.views)) {
        const countsEl = document.createElement('div');
        countsEl.className = 'xmr-viewer-counts';
        countsEl.textContent = [
          cts.reply ? '💬 ' + cts.reply : '',
          cts.rt ? '🔁 ' + cts.rt : '',
          cts.like ? '♥ ' + cts.like : '',
          cts.views ? '👁 ' + cts.views : '',
        ]
          .filter(Boolean)
          .join('　');
        caption.appendChild(countsEl);
      }
      if (entry.text) {
        const text = document.createElement('div');
        text.className = 'xmr-viewer-text';
        text.textContent = entry.text;
        caption.appendChild(text);
      }
    }
    if (entry && entry.href) {
      // いいね/ブックマーク/リプライの可視ボタン列。キー操作(2/3/4)と同じ
      // 処理をマウスでも押せるようにするだけで、状態の取得はしない
      // （対象セルがアンマウント済みのことが多く、正確な状態表示には
      // 毎回の再マウントが必要でコストに見合わないため。実行結果は
      // トーストで通知される）。
      // 検索メディア由来のエントリは操作の委譲先が存在しないため、
      // ボタン列自体を出さない（「このポストを開く」リンクは残す）。
      if (!entry.searchItem) {
      const actions = document.createElement('div');
      actions.className = 'xmr-viewer-actions';
      const mkBtn = (cls, label, title, fn) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'xmr-viewer-action-btn ' + cls;
        b.textContent = label;
        b.title = title;
        b.addEventListener('click', (ev) => {
          ev.stopPropagation();
          fn();
        });
        return b;
      };
      const likeBtn = mkBtn('xmr-viewer-act-like', '♥ ' + t('viewerLike'), t('withKey', [t('titleLikeToggle'), Settings.keys.like]), () => actOnEntry(entry, ['like', 'unlike']));
      likeBtn.classList.toggle('xmr-act-on-like', !!entry.liked);
      const bmBtn = mkBtn('xmr-viewer-act-bm', '🔖 ' + t('viewerBookmark'), t('withKey', [t('titleBookmarkToggle'), Settings.keys.bookmark]), () => actOnEntry(entry, ['bookmark', 'removeBookmark']));
      bmBtn.classList.toggle('xmr-act-on-bm', !!entry.bookmarked);
      actions.appendChild(likeBtn);
      actions.appendChild(bmBtn);
      const rtBtn = mkBtn('xmr-viewer-act-rt', '🔁 ' + t('viewerRepost'), t('withKey', [t('titleRepostToggle'), Settings.keys.retweet]), () => retweetEntry(entry));
      rtBtn.classList.toggle('xmr-act-on-rt', !!entry.retweeted);
      actions.appendChild(rtBtn);
      actions.appendChild(mkBtn('xmr-viewer-act-reply', '💬 ' + t('viewerReply'), t('withKey', [t('titleReply'), Settings.keys.reply]), () => openReplyComposerForEntry(entry)));
      caption.appendChild(actions);
      }
      const open = document.createElement('a');
      open.className = 'xmr-viewer-open';
      open.href = 'https://x.com' + entry.href;
      // 通常クリックは同タブSPA遷移（速い・戻りで復元）。hrefは残してある
      // ので、中クリック/Ctrl+クリックで新しいタブに開く選択肢も生きる。
      open.addEventListener('click', (ev) => {
        if (ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.button === 1) return;
        ev.preventDefault();
        ev.stopPropagation();
        openEntrySameTab(entry, false);
      });
      // 括弧内のキー表記はリマップ（Settings.keys）を反映する
      open.textContent = t('viewerOpenPost', [(Settings.keys.openTweet || 'r').toUpperCase()]);
      caption.appendChild(open);
      const author = tweetAuthorFromHref(entry.href);
      if (author) {
        const openMedia = document.createElement('a');
        openMedia.className = 'xmr-viewer-open xmr-viewer-open-secondary';
        openMedia.href = 'https://x.com/' + author + '/media';
        openMedia.addEventListener('click', (ev) => {
          if (ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.button === 1) return;
          ev.preventDefault();
          ev.stopPropagation();
          openEntrySameTab(entry, true);
        });
        openMedia.textContent = t('viewerOpenAccountMedia', [(Settings.keys.openMedia || 'f').toUpperCase()]);
        caption.appendChild(openMedia);
      }
    }
    return caption.children.length > 0 ? caption : null;
  }

  // プロフィールの自己紹介文(UserDescription)の子ノードを辿り、<a>タグ
  // （URL/ハッシュタグ/メンション等、Xが既に本物のリンクとして描画している
  // もの）とプレーンテキストを区別した配列にする。innerHTML丸ごとコピーは
  // Xの内部クラス名やイベントハンドラに依存して壊れやすいため使わない。
  function extractBioParts(el) {
    const parts = [];
    el.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        if (node.textContent) parts.push({ text: node.textContent });
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const a = node.tagName === 'A' ? node : node.querySelector('a');
        const text = node.textContent;
        if (a && a.href && text) parts.push({ text, href: a.href });
        else if (text) parts.push({ text });
      }
    });
    return parts;
  }

  // 複数画像のツイートは、以前はサムネイル一覧(medium解像度)を挟んでから
  // もう一段階（Space/Q）で1枚を拡大する二段構えだった。開いた瞬間から
  // 全部フルサイズで並べてほしいとの要望を受けてこの一覧自体はフルサイズに
  // したが、それでも「選んだ1枚をさらに大きく単独表示したい」という要望が
  // 別途あったため、Spaceで単独表示(renderSubImageFocus/'subview')に
  // 進める、という前の2段階の感覚は残した（A/Dは選択移動、Qで一覧に戻る）。
  function renderSubgrid() {
    const overlay = ensureOverlay();
    const body = overlay.querySelector('.xmr-overlay-body');
    body.innerHTML = '';
    const layout = document.createElement('div');
    layout.className = 'xmr-viewer-layout';
    const grid = document.createElement('div');
    grid.className = 'xmr-subgrid';
    grid.style.setProperty('--xmr-subcols', CONFIG.subGridCols);
    Grid.subImages.forEach((src, i) => {
      const img = document.createElement('img');
      img.src = fullSrc(src);
      if (i === Grid.subSelIndex) img.classList.add('xmr-selected');
      img.addEventListener('click', () => {
        Grid.subSelIndex = i;
        renderSubgrid();
      });
      grid.appendChild(img);
    });
    layout.appendChild(grid);
    const caption = buildViewerCaption(Grid.subEntry);
    if (caption) layout.appendChild(caption);
    body.appendChild(layout);
    overlay.classList.add('xmr-open');
    Grid.level = 'sub';
    // 実機報告：W/Sで上下の画像へ移動しても表示が追従せず、マウスで
    // スクロールしないと選択中の画像が見えなかった（グリッド一覧の
    // paintSelection()には追従があるのにこちらは入れ忘れていた）。
    const selImg = grid.children[Grid.subSelIndex];
    if (selImg && selImg.scrollIntoView) selImg.scrollIntoView({ block: 'nearest' });
  }

  // renderSubImageFocus/renderViewerの共通描画部分。画像とキャプションを
  // 毎回丸ごと作り直す(body.innerHTML='')と、新しい<img>がまだ読み込まれて
  // いない一瞬だけ画像の実寸が0になり、隣のキャプションパネルが画像の場所へ
  // 一瞬めり込んでから正しい位置へ飛ぶ「ちらつき」が実機で発生していた
  // （既にDOM上にある<img>のsrcだけを差し替えれば、ブラウザは新しい画像が
  // 届くまで前の画像を表示し続けるためこの崩れが起きない）。既に同じ構造
  // （画像1枚+キャプション）が表示されている時だけ既存要素を使い回し、
  // 別の階層（sub一覧等）から来た時だけ作り直す。
  function renderFocusedLayout(src, entry, level, badgeText) {
    const overlay = ensureOverlay();
    const body = overlay.querySelector('.xmr-overlay-body');
    let layout = body.children.length === 1 ? body.firstElementChild : null;
    let img = layout ? layout.querySelector(':scope > .xmr-fullimg') : null;
    if (!layout || !img) {
      body.innerHTML = '';
      layout = document.createElement('div');
      layout.className = 'xmr-viewer-layout';
      img = document.createElement('img');
      img.className = 'xmr-fullimg';
      layout.appendChild(img);
      body.appendChild(layout);
    }
    if (src) img.src = fullSrc(src);
    const oldBadge = layout.querySelector(':scope > .xmr-viewer-imgcount');
    if (oldBadge) oldBadge.remove();
    if (badgeText) {
      const badge = document.createElement('div');
      badge.className = 'xmr-viewer-imgcount';
      badge.textContent = badgeText;
      layout.appendChild(badge);
    }
    const oldCaption = layout.querySelector(':scope > .xmr-viewer-caption');
    if (oldCaption) oldCaption.remove();
    const caption = buildViewerCaption(entry);
    if (caption) layout.appendChild(caption);
    overlay.classList.add('xmr-open');
    Grid.level = level;
  }

  // renderSubgrid（一覧）でSpaceを押した時に、選択中の1枚だけをさらに
  // 大きく単独表示する。Qで戻る先はグリッド一覧ではなく1つ手前の
  // renderSubgrid（closeOverlayLevel側で対応）。
  function renderSubImageFocus() {
    const badge = Grid.subImages.length > 1 ? Grid.subSelIndex + 1 + '/' + Grid.subImages.length : null;
    renderFocusedLayout(Grid.subImages[Grid.subSelIndex], Grid.subEntry, 'subview', badge);
  }

  // 拡大表示は画像だけだと情報が少ないという指摘を受け、Xの画像ポスト表示に
  // 近い形（画像＋右に投稿者・本文・元ツイートを開くリンク）にした。
  // いいねボタン等をそのまま埋め込むことも検討したが、Xの本物のReact管理下の
  // ボタンをDOM上で移動させるのは動作が不安定になるリスクが高いため見送り、
  // 代わりに「Xで開く」を大きめのボタンにして、本物のいいね・リプライ等の
  // 操作はXの実物のページで行ってもらう方式にした。
  // グリッド一覧から画像クリックで直接この単独表示に入った場合、複数画像の
  // ツイートも(renderSubgridのような一覧ではなく)1枚ずつ単独表示する
  // （実機報告：単体・複数・単体と並んだ投稿をDで順に送っていく時、複数画像の
  // 投稿だけ2枚とも見ないうちに次の投稿へ飛んでしまっていた。images内の
  // 何枚目かをGrid.viewImageIndexで別途持ち、そちらを先に送り切ってから
  // 次の投稿へ進むようにした）。
  function renderViewer() {
    const entry = Grid.viewList[Grid.viewIndex];
    const src = entry ? entry.images[Grid.viewImageIndex] : null;
    const badge = entry && entry.images.length > 1 ? Grid.viewImageIndex + 1 + '/' + entry.images.length : null;
    renderFocusedLayout(src, entry, 'view', badge);
  }

  // グリッド一覧から画像クリックで開く単独表示専用の入り口
  // （複数画像のツイートを直接クリックした場合は、その投稿の全画像を
  // 一度に並べたいのでrenderSubgrid側（activateSelected参照）が担当する）。
  function openViewer() {
    // テキストのみのエントリを除いた「画像だけの平坦なリスト」を作ってから開く
    // （href遷移(Enter)のためentryオブジェクトごと保持する）
    Grid.viewList = Grid.entries.filter((en) => en.type !== 'text');
    const entry = Grid.entries[Grid.selIndex];
    const idx = entry ? Grid.viewList.indexOf(entry) : -1;
    Grid.viewIndex = idx >= 0 ? idx : 0;
    Grid.viewImageIndex = 0;
    renderViewer();
  }

  // ビューア内でA/D送りすると Grid.viewIndex だけが動き、一覧側の選択
  // (Grid.selIndex / ハイライト表示)が更新されないまま Qで閉じると、
  // 一覧に戻ってもフォーカスが元の位置から全く動いていないように見える
  // バグがあった。閉じるときに、今見ていた画像が一覧の何番目のエントリ
  // だったかを逆引きしてGrid.selIndexに反映させる。
  function closeOverlayLevel() {
    const overlay = ensureOverlay();
    if (Grid.level === 'subview') {
      // 単独表示(Space)から戻る先は一覧(sub)。オーバーレイ自体はまだ閉じない。
      renderSubgrid();
    } else if (Grid.level === 'view') {
      overlay.classList.remove('xmr-open');
      Grid.level = 'grid';
      const viewedEntry = Grid.viewList[Grid.viewIndex];
      if (viewedEntry) {
        const idx = Grid.entries.indexOf(viewedEntry);
        if (idx >= 0) Grid.selIndex = idx;
      }
      paintSelection();
    } else if (Grid.level === 'sub') {
      overlay.classList.remove('xmr-open');
      Grid.level = 'grid';
      paintSelection(); // 念のため（moveToAdjacentEntryでselIndexが動いている場合の保険）
    }
  }

  // 呼び出し元（Qキー・タイルクリック）はどちらもGrid.level==='grid'の
  // 時しか呼ばないので、グリッド一覧から「開く」場合だけを扱う。
  function activateSelected() {
    if (Grid.level !== 'grid') return;
    const entry = Grid.entries[Grid.selIndex];
    if (!entry) return;
    if (entry.type === 'text') {
      openTextEntry(entry);
      return;
    }
    if (entry.images.length > 1) {
      Grid.subEntry = entry;
      Grid.subImages = entry.images;
      Grid.subSelIndex = 0;
      renderSubgrid();
    } else {
      openViewer();
    }
  }

  // 現在表示中の画像がどのツイートのものかを、階層(grid/sub/subview/view)に応じて割り出す
  function currentEntry() {
    if (Grid.level === 'grid') return Grid.entries[Grid.selIndex] || null;
    if (Grid.level === 'sub' || Grid.level === 'subview') return Grid.subEntry;
    if (Grid.level === 'view') return Grid.viewList[Grid.viewIndex] || null;
    return null;
  }

  function tweetAuthorFromHref(href) {
    const m = href && href.match(/^\/([^/]+)\/status\//);
    return m ? m[1] : null;
  }

  // いいね/ブックマークは実機確認で`data-testid="like"/"unlike"`,
  // `"bookmark"/"removeBookmark"`という安定したパターンだった。本物の
  // ボタンは（グリッド表示中は隠れているが）click()自体は見た目の状態に
  // 依存しないので、フォローボタンと同じ「隠れたまま残し、自前のキー操作
  // からclick()を委譲する」方式で実装する。押すのはユーザー自身が明示的に
  // キーを押した時だけなので、自動いいね/自動ブックマークにはならない。
  // entryのhrefから、Grid.sourceRoot内にある本物のarticleを直接引く
  // （現在選択中のものに限らず、タイル上の小さいアクションボタンから
  // 個別のentryを直接指定して操作したい場合にも使う）。
  // 【実機報告バグの根本対策】リプライ(/compose)往復などのタイミングで
  // Xがリスト要素ごと作り直すことがあり、Grid.sourceRootが「DOMから
  // 切り離された古いツリー」を指したままになる。切り離されたツリー内でも
  // querySelectorはヒットするため、「ボタンは見つかるのにclick()が
  // 何も起こさない」という質の悪い壊れ方になる（2回目のリプライが
  // 開けない・いいねが実際には効かないのに表示だけ変わる、の正体）。
  // 参照が死んでいたら現在のDOMから取り直し、隠しクラスとobserverも
  // 付け直す。
  function ensureSourceRootAlive() {
    if (!Grid.active) return false;
    if (Grid.sourceRoot && Grid.sourceRoot.isConnected) return true;
    const cell = document.querySelector('[data-testid="primaryColumn"] [data-testid="cellInnerDiv"]');
    if (!cell || !cell.parentElement) return false;
    Grid.sourceRoot = cell.parentElement;
    Grid.sourceRoot.classList.add('xmr-source-hidden');
    if (Grid.sourceObserver) {
      Grid.sourceObserver.disconnect();
      Grid.sourceObserver.observe(Grid.sourceRoot, { childList: true, subtree: true });
    }
    return true;
  }

  function articleForEntry(entry) {
    if (!entry || !entry.href) return null;
    if (!ensureSourceRootAlive()) return null;
    const link = Grid.sourceRoot.querySelector('a[role="link"][href="' + CSS.escape(entry.href) + '"]');
    return link ? link.closest('article') : null;
  }

  // いいね/ブックマークキーの実行結果を短時間だけ画面に出すトースト。
  // 「押したのに何も起きていないように見える」のを防ぐため、成功・解除・
  // 失敗のどの結果でも必ず何かしら表示する。要素は1つを使い回し、表示の
  // たびにタイマーを張り直す。document.bodyへのappendChildなので設計原則4の
  // ガードを必ず通す。呼び出し元はキー操作（keydown）だけで、bodyObserverの
  // コールバックからは呼ばれないため、無限ループ（設計原則3）の心配はない。
  let actionToastEl = null;
  let actionToastTimer = null;
  function showActionToast(msg) {
    if (!document.body) return;
    if (!actionToastEl || !actionToastEl.isConnected) {
      // Xがbody直下を大規模に作り直した場合など、切り離されていたら作り直す
      actionToastEl = document.createElement('div');
      actionToastEl.className = 'xmr-toast';
      document.body.appendChild(actionToastEl);
    }
    actionToastEl.textContent = msg;
    actionToastEl.classList.add('xmr-toast-show');
    if (actionToastTimer) clearTimeout(actionToastTimer);
    actionToastTimer = setTimeout(() => {
      actionToastEl.classList.remove('xmr-toast-show');
      actionToastTimer = null;
    }, 1500);
  }

  // 実際にclick()したボタンのdata-testidを返す（トーストの文言分岐に使う）。
  // どのボタンも見つからなければnull。
  function pressActionButtonOn(article, testids) {
    // 切り離されたarticle（上記ensureSourceRootAliveのコメント参照）への
    // click()は何も起こさないので、成功扱いにしてはいけない
    if (!article || !article.isConnected) return null;
    for (const t of testids) {
      const btn = article.querySelector('[data-testid="' + t + '"]');
      if (btn) {
        btn.click();
        return t;
      }
    }
    return null;
  }

  const ACTION_TOAST_TEXT = {
    like: t('toastLiked'),
    unlike: t('toastUnliked'),
    bookmark: t('toastBookmarked'),
    removeBookmark: t('toastBookmarkRemoved'),
    retweet: t('toastReposted'),
    unretweet: t('toastRepostRemoved'),
  };

  let actionInFlight = false; // 再マウント待ち中の連打・多重実行防止
  let actionInFlightAt = 0;
  // 実機報告「リプライを一度使った後、ボタンが押せなくなった」への保険。
  // 何らかの経路（想定外の例外・Xの構造変化等）でactionInFlightが立ち
  // っぱなしになっても、8秒経過していれば残留とみなして強制解除する。
  function actionBusy() {
    if (!actionInFlight) return false;
    if (Date.now() - actionInFlightAt > 8000) {
      actionInFlight = false;
      return false;
    }
    return true;
  }

  // 対象entryの本物のセルがアンマウント済みの時、entry.ty（収穫時の
  // translateY座標）へ裏のリストを一時スクロールしてXにセルを再マウント
  // させ、articleを取り直す。終わったら元のスクロール位置へ戻す。
  // 実機検証で判明：グリッドの初期読み込み(pumpMore)は裏のリストを下まで
  // スクロールするため、上の方のタイルのセルはほとんどアンマウント済みで、
  // この再マウント無しではclick委譲はほぼ常に失敗する。
  // 設計原則6（大ジャンプ禁止）は「まだ収穫していないセルを跳び越えて
  // 内容を失う」ことを防ぐ原則であり、収穫済みの既知座標への一時ジャンプ＋
  // 復帰はその対象外（再マウントされたセルはGrid.seenのキー照合で重複収穫
  // もされない）。
  // 【v3.54.0での重要な変更・実機で確定】以前は「再マウント→元のスクロール
  // 位置へ復帰→呼び出し元がclick」という順番だったため、復帰した瞬間に
  // Xがセルを再アンマウントし、click()が切り離された要素への空振りになる
  // ことがあった。いいね（1クリック）はタイミング勝負でほぼ通っていたが、
  // リポスト（ボタン→確認メニューの2段階）では確実に露見した（実機報告：
  // 「Could not find the repost confirmation button」）。操作(fn)を
  // 「対象位置へスクロールしたまま」実行し終えてから復帰する形に変更。
  // fnの戻り値に関わらず、articleを見つけて実行できたらtrueを返す。
  async function withEntryArticle(entry, fn) {
    if (!entry) return false;
    let article = Grid.active ? articleForEntry(entry) : NativeNav.el && NativeNav.el.querySelector('article');
    if (article) {
      await fn(article);
      return true;
    }
    if (!Grid.active || !entry.href || typeof entry.ty !== 'number') return false;
    actionInFlight = true;
    actionInFlightAt = Date.now();
    const prevY = window.scrollY;
    const token = Grid.navToken;
    window.scrollTo(0, Math.max(0, entry.ty - Math.round(window.innerHeight / 2)));
    for (let i = 0; i < 8 && !article; i++) {
      await sleep(150);
      if (token !== Grid.navToken || !Grid.active) {
        actionInFlight = false;
        return false; // 待っている間にページ遷移等があれば何もしない
      }
      article = articleForEntry(entry);
    }
    if (!article) {
      window.scrollTo(0, prevY);
      actionInFlight = false;
      return false;
    }
    try {
      await fn(article); // スクロールを保持したまま操作を最後まで行う
    } finally {
      window.scrollTo(0, prevY);
      actionInFlight = false;
    }
    return true;
  }

  // いいね/ブックマーク実行後に、タイルとビューアの可視ボタンの色を
  // entryの状態(liked/bookmarked)に合わせて更新する（Xの本物のUIと同じく
  // 「押したら色が変わる」直感に合わせるため）。
  function refreshActionButtonStates(entry) {
    if (!entry) return;
    if (entry.tileEl) {
      const lb = entry.tileEl.querySelector('.xmr-tile-act-like');
      const bb = entry.tileEl.querySelector('.xmr-tile-act-bm');
      if (lb) lb.classList.toggle('xmr-act-on-like', !!entry.liked);
      if (bb) bb.classList.toggle('xmr-act-on-bm', !!entry.bookmarked);
    }
    if (entry.tileEl) {
      const rb = entry.tileEl.querySelector('.xmr-tile-act-rt');
      if (rb) rb.classList.toggle('xmr-act-on-rt', !!entry.retweeted);
    }
    if (currentEntry() === entry) {
      const vl = document.querySelector('.xmr-viewer-actions .xmr-viewer-act-like');
      const vb = document.querySelector('.xmr-viewer-actions .xmr-viewer-act-bm');
      const vr = document.querySelector('.xmr-viewer-actions .xmr-viewer-act-rt');
      if (vl) vl.classList.toggle('xmr-act-on-like', !!entry.liked);
      if (vb) vb.classList.toggle('xmr-act-on-bm', !!entry.bookmarked);
      if (vr) vr.classList.toggle('xmr-act-on-rt', !!entry.retweeted);
    }
  }

  // キー操作でいいね等をした時、対象タイルのボタン列を一時的に表示して
  // フェードアウトさせる（実機フィードバック：画面下のトーストだけだと
  // どのタイルにいいねしたか分かりにくい。ホバー時と同じ表示を、実行した
  // タイル限定で時間経過で消える形で出す）。
  function flashTileActions(entry) {
    if (!entry || !entry.tileEl) return;
    const tile = entry.tileEl;
    tile.classList.add('xmr-flash-actions');
    if (tile._xmrFlashTimer) clearTimeout(tile._xmrFlashTimer);
    tile._xmrFlashTimer = setTimeout(() => {
      tile.classList.remove('xmr-flash-actions');
      tile._xmrFlashTimer = null;
    }, 1500);
  }

  function applyActionResultToEntry(entry, clicked) {
    if (!entry || !clicked) return;
    if (clicked === 'like') entry.liked = true;
    else if (clicked === 'unlike') entry.liked = false;
    else if (clicked === 'bookmark') entry.bookmarked = true;
    else if (clicked === 'removeBookmark') entry.bookmarked = false;
    refreshActionButtonStates(entry);
    flashTileActions(entry);
  }

  // 特定のentryに対していいね/ブックマークを実行する（キー操作＝選択中
  // エントリからも、タイル/ビューアの可視ボタン＝任意のエントリからも使う）
  // 検索メディア由来のエントリは裏のセルが操作ボタンを持たないため、
  // どの操作も委譲できない。正直に伝えてRキーへ誘導する。
  function toastSearchItemUnsupported() {
    showActionToast(t('toastSearchUnsupported', [(Settings.keys.openTweet || 'r').toUpperCase()]));
  }

  async function actOnEntry(entry, testids) {
    if (actionBusy() || !entry) return;
    if (entry.searchItem) return toastSearchItemUnsupported();
    const ok = await withEntryArticle(entry, async (article) => {
      const clicked = pressActionButtonOn(article, testids);
      if (clicked) {
        applyActionResultToEntry(entry, clicked);
        showActionToast(ACTION_TOAST_TEXT[clicked] || t('toastDone'));
      } else {
        // articleはあるのにlike/bookmark系ボタンが1つも無い（Xの構造変更等）
        showActionToast(t('toastActionButtonNotFound'));
      }
    });
    if (!ok) {
      // 再マウントも効かなかった（scrollToが仮想リストを再同期できない
      // ケースは既知）。無関係な記事へフォールバックせず正直に伝える。
      showActionToast(t('toastRelocateFailed', [(Settings.keys.openTweet || 'r').toUpperCase()]));
    }
  }

  async function pressActionButton(testids) {
    if (actionBusy()) return;
    if (Grid.active) {
      const entry = currentEntry();
      if (!entry) {
        showActionToast(t('toastNoSelection'));
        return;
      }
      return actOnEntry(entry, testids);
    }
    // 通常タイムライン（グリッド未使用。ビューアだけ開いている場合も含む）
    // はW/Sで選択中の記事から直接探す
    const article = NativeNav.el ? NativeNav.el.querySelector('article') : null;
    if (!article) {
      showActionToast(t('toastNoSelection'));
      return;
    }
    const clicked = pressActionButtonOn(article, testids);
    if (clicked) {
      showActionToast(ACTION_TOAST_TEXT[clicked] || t('toastDone'));
    } else {
      showActionToast(t('toastActionButtonNotFound'));
    }
  }

  // リポスト：Xのリポストボタンは押すと「リポスト/引用」の確認メニューが
  // 出る2段階UI。ここからは「リポスト」（単純リポスト）だけを実行する
  // （引用は文章入力が必要なので対象外。引用したい時はRキーでツイートを
  // 開いて通常のUIから）。解除も同様の2段階（unretweet→unretweetConfirm）。
  // 確認メニューは#layers内に出るためグリッドの裏に隠れて見えないが、
  // click()は見た目の状態に依存しないので問題ない。
  // いいね等と同じく、実行されるのはユーザーがキー/ボタンを押した時だけ。
  async function retweetFromArticle(article, entry) {
    if (!article || !article.isConnected) {
      showActionToast(t('toastRelocateFailed', [(Settings.keys.openTweet || 'r').toUpperCase()]));
      return;
    }
    const isRetweeted = !!article.querySelector('[data-testid="unretweet"]');
    const btn = article.querySelector(isRetweeted ? '[data-testid="unretweet"]' : '[data-testid="retweet"]');
    if (!btn) {
      showActionToast(t('toastRepostButtonNotFound'));
      return;
    }
    btn.click();
    const confirmSel = isRetweeted ? '[data-testid="unretweetConfirm"]' : '[data-testid="retweetConfirm"]';
    const confirmBtn = await waitFor(() => document.querySelector(confirmSel), 2000, 60);
    if (!confirmBtn) {
      // 確認メニューが開けなかった/構造が変わった。開きっぱなしのメニューが
      // あれば閉じておく（見えないメニューが残ると操作を吸われるため）。
      const menu = document.querySelector('[role="menu"]');
      if (menu) {
        const backdrop = findMenuBackdrop(menu);
        if (backdrop) backdrop.click();
      }
      showActionToast(t('toastRepostConfirmNotFound'));
      return;
    }
    confirmBtn.click();
    if (entry) {
      entry.retweeted = !isRetweeted;
      refreshActionButtonStates(entry);
      flashTileActions(entry);
    }
    showActionToast(isRetweeted ? ACTION_TOAST_TEXT.unretweet : ACTION_TOAST_TEXT.retweet);
  }

  async function retweetEntry(entry) {
    if (actionBusy() || !entry) return;
    if (entry.searchItem) return toastSearchItemUnsupported();
    // リポストは確認メニューまで含む2段階操作なので、withEntryArticleの
    // 「スクロール保持のまま完了させる」挙動が特に重要（1段目のclickが
    // アンマウント済み要素への空振りになると確認ボタンが永遠に出ない）
    const ok = await withEntryArticle(entry, (article) => retweetFromArticle(article, entry));
    if (!ok) {
      showActionToast(t('toastRelocateFailed', [(Settings.keys.openTweet || 'r').toUpperCase()]));
    }
  }

  async function pressRetweet() {
    if (actionBusy()) return;
    if (Grid.active) {
      const entry = currentEntry();
      if (!entry) {
        showActionToast(t('toastNoSelection'));
        return;
      }
      return retweetEntry(entry);
    }
    const article = NativeNav.el ? NativeNav.el.querySelector('article') : null;
    if (!article) {
      showActionToast(t('toastNoSelection'));
      return;
    }
    await retweetFromArticle(article, null);
  }

  // リプライ：選択中の投稿の本物のリプライボタンへclick()を委譲して、
  // Xの標準のリプライ入力モーダルを開く（ツイートページを開く必要が無く
  // ロード0秒）。文章の入力・送信は完全にXの本物のUIで、ユーザー自身が行う
  // （この拡張は「開く」だけ。表示専用の大原則の範囲内）。
  // 実機検証で判明した2つの前提：
  //  (1) メディア欄含め、裏のセルはreplyボタンを持っている
  //  (2) モーダル自体は開くが、Xのモーダル層(#layers, z-index:1)は
  //      グリッドのshell(z-index:40)より下に描画されるため、そのままだと
  //      グリッドの裏に隠れて見えない。開いている間だけ#layersを持ち上げる
  //      CSSクラス(xmr-compose-open)をhtml要素に付けて解決する。
  async function openReplyComposerForEntry(entry) {
    if (actionBusy() || !entry) return;
    if (entry.searchItem) return toastSearchItemUnsupported();
    const ok = await withEntryArticle(entry, (article) => openReplyFromArticle(article));
    if (!ok) {
      showActionToast(t('toastRelocateFailed', [(Settings.keys.openTweet || 'r').toUpperCase()]));
    }
  }

  async function openReplyComposer() {
    if (actionBusy()) return;
    if (Grid.active) {
      const entry = currentEntry();
      if (!entry) {
        showActionToast(t('toastNoSelection'));
        return;
      }
      return openReplyComposerForEntry(entry);
    }
    // 通常タイムライン（ビューアのみ表示中も含む）はW/S選択中の記事から
    const article = NativeNav.el ? NativeNav.el.querySelector('article') : null;
    if (!article) {
      showActionToast(t('toastNoSelection'));
      return;
    }
    openReplyFromArticle(article);
  }

  async function openReplyFromArticle(article) {
    if (!article || !article.isConnected) {
      showActionToast(t('toastRelocateFailed', [(Settings.keys.openTweet || 'r').toUpperCase()]));
      return;
    }
    const replyBtn = article.querySelector('[data-testid="reply"]');
    if (!replyBtn) {
      showActionToast(t('toastReplyButtonNotFound'));
      return;
    }
    replyBtn.click();
    const composer = await waitFor(() => document.querySelector('[role="dialog"] [data-testid="tweetTextarea_0"]'), 3000, 100);
    if (!composer) {
      showActionToast(t('toastReplyOpenFailed'));
      return;
    }
    document.documentElement.classList.add('xmr-compose-open');
    // モーダルが閉じられたら（送信・Escape・×ボタンいずれでも）持ち上げを解除する
    const watch = setInterval(() => {
      if (!document.querySelector('[role="dialog"] [data-testid="tweetTextarea_0"]')) {
        clearInterval(watch);
        document.documentElement.classList.remove('xmr-compose-open');
      }
    }, 400);
  }

  function urlForEntry(entry, openMedia) {
    if (!entry || !entry.href) return null;
    if (!openMedia) return 'https://x.com' + entry.href;
    const author = tweetAuthorFromHref(entry.href);
    // 実機報告：Fキーで新しいタブに開いたメディア欄が、最新の投稿が反映
    // されないまま古い状態で表示されることがある（リロードすると直る）。
    // 原因を確実に断つ手段が無かったため、確実に効くと分かっている
    // 「リロード」を新しいタブの初回表示直後に自動で1回だけ行うことにした
    // （#xmr-freshの印を付けて開き、下のREOAD_MARKER処理で検知して
    // マーカーを外してからlocation.reload()する）。一瞬ちらつくトレードオフ
    // はあるが、内容が古いままになるよりはこちらを優先する。
    return author ? 'https://x.com/' + author + '/media#xmr-fresh' : null;
  }

  // Xの内部ルーター(SPA)で同じタブ内を遷移する。
  // 【v3.55.0で新規タブ方式から全面変更・実機フィードバック】新しいタブを
  // 開く方式はXの丸ごと初回ロードが走って数秒待たされ、素のXでクリック
  // 遷移する方が速い＝普段使いの使用感で本家に負けていた。pushState+
  // popstate発火でXのルーターに遷移させると、ネイティブのクリックと同じ
  // 速さになる（この方式が効くことは「動画」ピルで実機確認済み）。
  // 戻る（ブラウザの戻る/マウスのサイドボタン）で元のグリッドURLへ帰って
  // きた時は、GridCacheが読み込み直しゼロで位置ごと復元する。
  // 副産物として動画問題も解決：Rでステータスページへ飛べばXの本物の
  // プレイヤーで再生でき、戻ればグリッドに即復帰できる。
  function xmrSpaNavigate(path) {
    history.pushState(null, '', path);
    window.dispatchEvent(new PopStateEvent('popstate', { state: history.state }));
  }

  function openEntrySameTab(entry, openMedia) {
    if (!entry || !entry.href) return;
    if (openMedia) {
      const author = tweetAuthorFromHref(entry.href);
      if (!author) return;
      // 行き先は設定(fTarget)で選択：プロフィール（デフォルト）かメディア欄。
      // SPA遷移では新規タブ時代の#xmr-freshリロードは不要（あれは初回
      // ロード時のXのスクロール復元スナップショット問題への対策だった）。
      if (Settings.fTarget === 'media') {
        // ?filter=photoへ直接行くことでリダイレクトの一往復も省く
        xmrSpaNavigate('/' + author + '/media?filter=photo');
      } else {
        xmrSpaNavigate('/' + author);
      }
      return;
    }
    xmrSpaNavigate(entry.href);
  }

  // R: そのツイートを開く／F: その投稿者のメディア欄を開く（同じタブ内SPA遷移。
  // 以前は新しいタブ方式だったが、ロードの長さで本家のクリック遷移に負けて
  // いたため同タブ+戻りで復元の方式に変更）
  function openInNewTab(openMedia) {
    openEntrySameTab(currentEntry(), openMedia);
  }

  // 画像を持たないツイートは自前ビューアを使わず、Xの本物のツイートへ遷移する。
  // 裏に残っている本物のリンクが見つかればSPA遷移、無ければ通常のURL遷移にフォールバック。
  function openTextEntry(entry) {
    if (!entry.href) return;
    const real =
      Grid.sourceRoot && Grid.sourceRoot.querySelector('a[role="link"][href="' + CSS.escape(entry.href) + '"]');
    if (real) {
      real.click();
    } else {
      window.location.assign(entry.href);
    }
  }

  // scrollIntoView()自体が発生させる'scroll'イベントを、下のupdateSelectionFromScroll()
  // が「ユーザーの手スクロール」と誤認して選択位置を再計算してしまわないよう、
  // 自分でスクロールを起こした直後は一定時間そちらを黙らせる（実機報告：
  // 列を維持する修正を入れてもなお、WASDのSキーだけで選択が1列目へ戻る
  // 症状が残っていた。scrollIntoView後のイベント処理タイミング次第では
  // updateSelectionFromScroll側の再計算がズレて発火し得るため、根本的に
  // 「自分で起こしたスクロールには反応しない」形にして再発を防ぐ）。
  let suppressScrollSyncUntil = 0;
  // skipScroll: マウスでのスクロールに合わせて選択位置を追従させる時に
  // 使う。scrollIntoView()を呼ぶとこちらからスクロールを起こしてしまい、
  // ユーザーの手動スクロールを打ち消してしまうため、その場合は見た目
  // （枠線）の更新だけ行う。
  function paintSelection(skipScroll) {
    Grid.entries.forEach((en, i) => {
      if (en.tileEl) en.tileEl.classList.toggle('xmr-selected', Grid.level === 'grid' && i === Grid.selIndex);
    });
    const sel = Grid.entries[Grid.selIndex];
    // 実機報告：拡大表示のままW/Sで別の投稿へ移動していくと、裏のグリッドの
    // スクロール位置が置き去りになり、閉じた時に選択タイルが画面外＝
    // 「わざわざマウスで下までスクロールしないといけない」状態になっていた。
    // 裏で追従させておけば閉じた瞬間からWASDを続けられる。ビューア表示中は
    // グリッドが見えていないのでスクロールが動いても視覚的な副作用は無い。
    if (sel && sel.tileEl && !skipScroll) {
      suppressScrollSyncUntil = Date.now() + 500;
      sel.tileEl.scrollIntoView({ block: 'center', behavior: 'auto' });
    }
    // 既読の「区切り」はWASD等で実際に到達した位置まで。pumpMore()が先読みで
    // 裏に何十件も読み込んでいても、それだけでは既読扱いにしない（実機報告：
    // 全く見ていないタイルまで既読=青になっていた）。選択位置が進むたびに
    // 「ここまでは実際に到達した」という最大到達位置を更新しておき、
    // markAllLoadedAsSeen()はこの範囲だけを既読にする。
    Grid.maxSeenIndex = Math.max(Grid.maxSeenIndex, Grid.selIndex);
  }

  // マウスでスクロールした後にWASDへ切り替えると、選択位置(Grid.selIndex)が
  // 古いままだったのでpaintSelection()のscrollIntoView()に引っ張られて
  // 元の位置へ急に戻ってしまう、という報告があった。スクロールに合わせて
  // 「今シェルの中央に一番近いタイル」へ選択位置を追従させることで、
  // マウススクロール→WASDの切り替えが自然につながるようにする。
  function updateSelectionFromScroll() {
    if (!Grid.active || Grid.level !== 'grid' || !Grid.shellEl || Grid.entries.length === 0) return;
    if (Date.now() < suppressScrollSyncUntil) return; // 自分のscrollIntoView由来のイベントは無視
    const shellRect = Grid.shellEl.getBoundingClientRect();
    const centerY = shellRect.top + shellRect.height / 2;
    let bestIdx = Grid.selIndex;
    let bestDist = Infinity;
    const filterActive = Grid.filterUnread || Grid.filterVideoOnly;
    // 「未読のみ」「動画のみ」が有効な間はdisplay:noneで隙間なく詰めている
    // ため、配列インデックス(i % cols)と見た目の列がもう対応していない。
    // 最初はここで単純に「列を保つ判定自体をやめる」対応をしたが、それだと
    // 今度は縦スクロールしただけで選択が別の列へ移ってしまう不具合が残って
    // いた（実機報告）。列を保つこと自体はやめず、判定方法だけ配列
    // インデックスではなく実際の描画位置(X座標)に変える：現在選択中の
    // タイルの中心Xに近いタイルだけを候補にする（spatialNeighbor()と同じ
    // 「実測位置で判断する」考え方）。
    const cols = CONFIG.gridCols;
    const curCol = Grid.selIndex % cols;
    const curTile = Grid.entries[Grid.selIndex] && Grid.entries[Grid.selIndex].tileEl;
    const curRect = filterActive && curTile ? curTile.getBoundingClientRect() : null;
    const curCx = curRect ? curRect.left + curRect.width / 2 : null;
    Grid.entries.forEach((en, i) => {
      if (!filterActive && i % cols !== curCol) return;
      if (filterActive && tileIsFilteredOut(en)) return;
      if (!en.tileEl) return;
      const r = en.tileEl.getBoundingClientRect();
      if (filterActive && curCx !== null) {
        const cx = r.left + r.width / 2;
        if (Math.abs(cx - curCx) > r.width / 2 + 4) return; // 同じ列（実測位置基準）だけを対象にする
      }
      if (r.bottom < shellRect.top || r.top > shellRect.bottom) return; // 完全に画面外は対象外
      const dist = Math.abs((r.top + r.bottom) / 2 - centerY);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    });
    if (bestIdx !== Grid.selIndex) {
      Grid.selIndex = bestIdx;
      paintSelection(true); // ここではスクロールを起こさない
    }
  }

  // サブグリッド／サブ由来のビューアで端まで行ったら、隣のツイート（写真つき
  // のもの）へ乗り換える。1枚だけの投稿を見ているときと同じ感覚でA/D送りが
  // 続けられるようにするため（実機報告：複数画像の投稿だけ端で止まって
  // 次のポストに進めないバグ）。
  // focusMode: 'subview'（Space後の単独表示）から端まで行った場合はtrueにして、
  // 乗り換え先も単独表示のまま続けられるようにする（一覧に戻ってしまわないように）。
  function moveToAdjacentEntry(delta, focusMode) {
    let i = Grid.selIndex + delta;
    while (i >= 0 && i < Grid.entries.length && Grid.entries[i].type !== 'photo') i += delta;
    if (i < 0 || i >= Grid.entries.length) return false; // 端まで来た。何もしない
    Grid.selIndex = i;
    paintSelection();
    const entry = Grid.entries[i];
    if (entry.images.length > 1) {
      Grid.subEntry = entry;
      Grid.subImages = entry.images;
      Grid.subSelIndex = delta > 0 ? 0 : entry.images.length - 1;
      if (focusMode) renderSubImageFocus();
      else renderSubgrid();
    } else {
      openViewer();
    }
    return true;
  }

  // 「未読のみ表示」「動画のみ表示」トグル用。CSS側でdisplay:noneにして
  // いるタイルの判定（WASD側で「消えているタイルには止まらない」ように
  // するのと、CSSの:not()/クラス判定を都度書かずに済ませるため共通化）。
  function tileIsFilteredOut(entry) {
    if (!entry) return false;
    if (Grid.filterUnread) {
      const tweetId = tweetIdFromHref(entry.href);
      if (tweetId && loadSeenTweets().has(tweetId)) return true;
    }
    if (Grid.filterVideoOnly && !entry.isVideo) return true;
    return false;
  }

  function refreshFilterToggleLabels() {
    if (!Grid.shellEl) return;
    // ON/OFFは文字だけでなく色でも分かるようにする（実機フィードバック。
    // ONの間はXブランド色の背景＝ホームタブのアクティブ表示と同じ言語）。
    const unreadBtn = Grid.shellEl.querySelector('.xmr-tb-filter-unread');
    if (unreadBtn) {
      unreadBtn.textContent = t('filterUnread') + ': ' + (Grid.filterUnread ? 'ON' : 'OFF');
      unreadBtn.classList.toggle('xmr-tb-on', Grid.filterUnread);
    }
    const videoBtn = Grid.shellEl.querySelector('.xmr-tb-filter-video');
    if (videoBtn) {
      videoBtn.textContent = t('filterVideoOnly') + ': ' + (Grid.filterVideoOnly ? 'ON' : 'OFF');
      videoBtn.classList.toggle('xmr-tb-on', Grid.filterVideoOnly);
    }
  }

  // フィルタをONにした瞬間、今の選択がちょうど非表示になったタイルの上に
  // 乗っていることがある（例：既読のツイートを選んだ状態で「未読のみ」を
  // ONにする）。その場合だけ、最寄りの表示中タイルへ選択をずらす。
  function ensureSelectionVisible() {
    if (Grid.level !== 'grid') return;
    if (!tileIsFilteredOut(Grid.entries[Grid.selIndex])) return;
    for (let i = Grid.selIndex; i < Grid.entries.length; i++) {
      if (!tileIsFilteredOut(Grid.entries[i])) {
        Grid.selIndex = i;
        paintSelection();
        return;
      }
    }
    for (let i = Grid.selIndex; i >= 0; i--) {
      if (!tileIsFilteredOut(Grid.entries[i])) {
        Grid.selIndex = i;
        paintSelection();
        return;
      }
    }
  }

  // フィルタ有効時のW/S専用：selIndex±colsの配列インデックス計算は使わず、
  // 選択中タイルの実際の描画位置(getBoundingClientRect)から「指定方向
  // (上/下)に一番近い、非表示になっていないタイル」を探す。display:noneで
  // 隙間なく詰めるとCSS Gridの自動配置により見た目の列と配列インデックスの
  // 対応が崩れるため（過去に同じ理由でWASDが繰り返し壊れた教訓）、フィルタが
  // 有効な間だけは配列インデックスではなく実測位置だけを信じる。
  function spatialNeighbor(fromTile, dir) {
    const fromRect = fromTile.getBoundingClientRect();
    const fromCx = fromRect.left + fromRect.width / 2;
    const fromCy = fromRect.top + fromRect.height / 2;
    let best = null;
    let bestScore = Infinity;
    for (const en of Grid.entries) {
      if (!en.tileEl || en.tileEl === fromTile || tileIsFilteredOut(en)) continue;
      const r = en.tileEl.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      let primary;
      let secondary;
      if (dir === 'down') {
        if (cy <= fromCy + 1) continue;
        primary = cy - fromCy;
        secondary = Math.abs(cx - fromCx);
      } else {
        if (cy >= fromCy - 1) continue;
        primary = fromCy - cy;
        secondary = Math.abs(cx - fromCx);
      }
      // 同じ列に近いものを優先しつつ、その中では近い方を選ぶ
      const score = secondary * 1000 + primary;
      if (score < bestScore) {
        bestScore = score;
        best = en;
      }
    }
    return best;
  }

  function stepFiltered(delta) {
    // A/D（|delta|===1）は配列の並び順（＝読み順）でそのまま次/前の表示中
    // タイルへ進む。実機報告：5列目でD、1列目でAを押しても行の折り返しが
    // 起きない不具合があった。spatialNeighbor()の「右方向」は同じ行の
    // より右にあるタイルしか探さないため、行の最後（一番右）では次候補が
    // 見つからず止まってしまっていた。配列インデックスは非表示タイルが
    // あっても並び順自体は変わらないので、+1していくだけで自然に次の行の
    // 先頭へ折り返せる（表示/非表示に関わらず読み順は保たれているため）。
    if (Math.abs(delta) === 1) {
      let next = Grid.selIndex;
      let guard = 0;
      do {
        next += delta;
        guard++;
      } while (next >= 0 && next < Grid.entries.length && tileIsFilteredOut(Grid.entries[next]) && guard <= Grid.entries.length);
      if (next < 0 || next >= Grid.entries.length) return;
      Grid.selIndex = next;
      paintSelection();
      maybePumpNearEnd();
      return;
    }
    // W/S（縦移動）は今まで通り、選択中タイルの実際の描画位置から
    // 一番近い表示中タイルを探す（列を保つ意味が薄れるうえ、詰まった後の
    // 行の境目はインデックス計算だけでは分からないため）。
    const cur = Grid.entries[Grid.selIndex];
    const curTile = cur && cur.tileEl;
    if (!curTile) return;
    const next = spatialNeighbor(curTile, delta > 0 ? 'down' : 'up');
    if (!next) return;
    const idx = Grid.entries.indexOf(next);
    if (idx < 0) return;
    Grid.selIndex = idx;
    paintSelection();
    maybePumpNearEnd();
  }

  function step(delta) {
    // 実機検証で判明：settleGridOrder()を一度だけ行うかどうかの判定に
    // それまでGrid.maxSeenIndex(>0)を使っていたが、これはWASD等の意図的な
    // 操作だけでなく、マウススクロールに追従するupdateSelectionFromScroll()
    // でも動いてしまう。初回読み込み中に一度でもマウスホイールでスクロール
    // すると（冷起動時のヒント表示でまさに勧めている操作）、その時点で
    // maxSeenIndexが0より大きくなり、まだ一度もWASDを押していないのに
    // settleGridOrder()がスキップされて並び順が整わないまま、という抜け穴が
    // あった。WASD/A/D/Spaceでの意図的な移動だけを「もう操作を始めた」と
    // 見なす専用フラグに分離する。
    Grid.userHasNavigated = true;
    if (Grid.level === 'grid') {
      if (Grid.filterUnread || Grid.filterVideoOnly) {
        stepFiltered(delta);
      } else {
        // フィルタが無い時は今まで通りの配列インデックス計算のみ（一切変更なし）。
        Grid.selIndex = Math.max(0, Math.min(Grid.entries.length - 1, Grid.selIndex + delta));
        paintSelection();
        maybePumpNearEnd();
      }
    } else if (Grid.level === 'sub') {
      const next = Grid.subSelIndex + delta;
      if (next >= 0 && next < Grid.subImages.length) {
        Grid.subSelIndex = next;
        renderSubgrid();
      } else {
        moveToAdjacentEntry(delta, false);
      }
    } else if (Grid.level === 'subview') {
      if (Math.abs(delta) !== 1) return; // W/Sの縦移動は単独表示では意味が無いので無視
      const next = Grid.subSelIndex + delta;
      if (next >= 0 && next < Grid.subImages.length) {
        Grid.subSelIndex = next;
        renderSubImageFocus();
      } else {
        moveToAdjacentEntry(delta, true);
      }
    } else if (Grid.level === 'view') {
      // A/D(delta=±1)で送る時は、複数画像のツイートならその中の画像を
      // 全部見終えてから次のツイートへ進む（実機報告：単体/複数/単体と
      // 並んだ投稿をDで送ると、複数画像の投稿だけ1枚目しか見えないうちに
      // 次の投稿へ飛んでしまっていた）。W/S(moveRow経由、|delta|>1)による
      // 複数投稿ジャンプは従来通り画像の途中経過を無視して直接ジャンプする。
      const entry = Grid.viewList[Grid.viewIndex];
      if (entry && Math.abs(delta) === 1) {
        const nextImgIdx = Grid.viewImageIndex + delta;
        if (nextImgIdx >= 0 && nextImgIdx < entry.images.length) {
          Grid.viewImageIndex = nextImgIdx;
          renderViewer();
          return;
        }
      }
      Grid.viewIndex = Math.max(0, Math.min(Grid.viewList.length - 1, Grid.viewIndex + delta));
      const nextEntry = Grid.viewList[Grid.viewIndex];
      Grid.viewImageIndex = delta > 0 ? 0 : Math.max(0, nextEntry ? nextEntry.images.length - 1 : 0);
      renderViewer();
      // 裏の一覧の選択・スクロールも道連れにしておく（実機報告：拡大表示で
      // 下へ送っていくと、閉じた時にグリッドが元の位置のままで、そこから
      // マウススクロールし直す羽目になっていた）。閉じる時にも
      // closeOverlayLevel()が同期するが、途中で他の操作（いいね等）が
      // 挟まっても常に一致しているようここでも合わせる。
      if (nextEntry) {
        const gi = Grid.entries.indexOf(nextEntry);
        if (gi >= 0) {
          Grid.selIndex = gi;
          paintSelection();
          maybePumpNearEnd();
        }
      }
    }
  }

  function moveRow(dir) {
    const cols = Grid.level === 'sub' ? CONFIG.subGridCols : CONFIG.gridCols;
    step(dir * cols);
  }

  // Space長押し用の一定速度スクロール。単押しのたびにsmooth scrollBy()を
  // 呼び直すOSキーリピート方式だと、前のアニメーションが終わる前に次が
  // 割り込んで打ち消し合い「がくがくしながらゆっくり進む」ことが実機で
  // 確認されたため、長押し中はrequestAnimationFrameで経過時間に応じて
  // scrollTopを直接動かす一定速度の方式に切り替える。
  let spaceHoldActive = false;
  let spaceHoldLastTs = null;
  function spaceHoldStep(ts) {
    if (!spaceHoldActive || !Grid.shellEl || Grid.level !== 'grid') {
      spaceHoldActive = false;
      spaceHoldLastTs = null;
      return;
    }
    if (spaceHoldLastTs != null) {
      const dt = ts - spaceHoldLastTs;
      Grid.shellEl.scrollTop += (CONFIG.spaceHoldScrollPxPerSec * dt) / 1000;
    }
    spaceHoldLastTs = ts;
    requestAnimationFrame(spaceHoldStep);
  }
  function startSpaceHoldScroll() {
    if (spaceHoldActive) return;
    // 単押し(repeat:false)で始まったsmooth scrollBy()アニメーションが、
    // 長押し判定に切り替わった時点でもまだ動いている可能性がある。動いた
    // ままだとこのあとのrequestAnimationFrameループとscrollTopを取り合って
    // 少しがくつくため（実機報告：改善したがまだ少し残っている）、今の位置へ
    // instant（アニメーション無し）で入れ直すことで進行中のアニメーションを
    // 打ち切ってから一定速度ループを始める。
    if (Grid.shellEl) {
      Grid.shellEl.scrollTo({ top: Grid.shellEl.scrollTop, behavior: 'instant' });
    }
    spaceHoldActive = true;
    spaceHoldLastTs = null;
    requestAnimationFrame(spaceHoldStep);
  }
  function stopSpaceHoldScroll() {
    spaceHoldActive = false;
    spaceHoldLastTs = null;
  }
  document.addEventListener('keyup', (e) => {
    if (e.key === ' ') stopSpaceHoldScroll();
  });

  document.addEventListener('keydown', (e) => {
    if (!Grid.active) return;
    if (isTypingTarget(e.target)) return;
    const k = e.key.toLowerCase();
    // グリッド一覧の状態ではQは「開く」のまま（1枚ならビューア、複数ならサブグリッドへ）。
    // サブグリッド／ビューアの状態からはQは常に「閉じる／1階層戻る」。
    // サブグリッドで特定の1枚を選んで開く操作だけSpaceに分離した
    // （複数画像のときQを連打すると開きっぱなしで閉じられない、という事故があったため）。
    if (k === Settings.keys.openClose) {
      e.preventDefault();
      if (Grid.level === 'grid') activateSelected();
      else closeOverlayLevel();
      return;
    }
    if (e.key === ' ') {
      // グリッド一覧ではXの通常のタイムラインのように、Spaceで1画面分くらい
      // 滑らかにスクロールしてほしいとの要望。ただし長押しするとOSのキー
      // リピートで大量のkeydownが連発され、そのたびにこのsmooth scrollBy()を
      // 呼び直すと、前のスクロールアニメーションが完了しないうちに次が
      // 割り込んで打ち消し合い、「がくがくしながらゆっくり進む」不具合に
      // なっていた（実機報告）。e.repeat（OSのキーリピートによる自動発火か
      // どうか）で単押しと長押しを区別し、長押し中は滑らかなアニメーションを
      // 都度起こすのではなく、一定速度で動き続けるrequestAnimationFrameの
      // ループに切り替える（startSpaceHoldScroll/keyupで停止）。
      if (Grid.level === 'grid' && Grid.shellEl) {
        e.preventDefault();
        Grid.userHasNavigated = true; // step()と同じ理由（settleGridOrder()の取りこぼし防止）
        if (e.repeat) {
          startSpaceHoldScroll();
        } else {
          stopSpaceHoldScroll();
          Grid.shellEl.scrollBy({ top: Math.round(Grid.shellEl.clientHeight * 0.9), behavior: 'smooth' });
        }
        return;
      }
      // 複数画像の一覧(sub)では、以前の「Spaceで選択中の1枚を開く」動作を
      // 引き続き使いたいとの要望。選択中の1枚だけをさらに大きく単独表示する。
      if (Grid.level === 'sub') {
        e.preventDefault();
        renderSubImageFocus();
        return;
      }
      // それ以外（単独表示中/単一画像ビューア中）はSpaceで何も起きてほしくない
      // との要望。ここでpreventDefaultしないとブラウザ標準のSpaceキー動作
      // （ページを下へスクロール）が発火して背後のページがスクロールして
      // しまうバグがあった。
      if (Grid.level === 'subview' || Grid.level === 'view') {
        e.preventDefault();
      }
      return;
    }
    if (e.key === 'Escape') {
      if (Grid.level !== 'grid') {
        e.preventDefault();
        closeOverlayLevel();
      }
      return;
    }
    if (k === Settings.keys.openTweet) {
      e.preventDefault();
      openInNewTab(false);
      return;
    }
    if (k === Settings.keys.openMedia) {
      e.preventDefault();
      openInNewTab(true);
      return;
    }
    if (k === Settings.keys.like) {
      e.preventDefault();
      pressActionButton(['like', 'unlike']);
      return;
    }
    if (k === Settings.keys.bookmark) {
      e.preventDefault();
      pressActionButton(['bookmark', 'removeBookmark']);
      return;
    }
    if (k === Settings.keys.reply) {
      e.preventDefault();
      openReplyComposer();
      return;
    }
    if (k === Settings.keys.retweet) {
      e.preventDefault();
      pressRetweet();
      return;
    }
    if (k === Settings.keys.refresh && Grid.mode === 'home') {
      // ホームアイコンとツールバーの更新ボタンは実質同じ処理(refreshHomeTimeline)
      // なので、そのままこのキーに割り当てる。
      e.preventDefault();
      refreshHomeTimeline();
      return;
    }
    if (k === Settings.keys.moveRight || e.key === 'ArrowRight') {
      e.preventDefault();
      step(1);
    } else if (k === Settings.keys.moveLeft || e.key === 'ArrowLeft') {
      e.preventDefault();
      step(-1);
    } else if (k === Settings.keys.moveDown || e.key === 'ArrowDown') {
      e.preventDefault();
      moveRow(1);
    } else if (k === Settings.keys.moveUp || e.key === 'ArrowUp') {
      e.preventDefault();
      moveRow(-1);
    }
  });

  // ============================================================
  // 機能6: 通常のタイムライン（画像のみ表示OFFのホーム／単体ツイートの
  // パーマリンクページ等、自前グリッドを使っていないページ）でも
  // WASDQで記事を選んで画像を拡大できるようにしてほしいという要望。
  //
  // 拡大表示(サブグリッド/ビューア)は既にGrid.level('grid'|'sub'|'view')の
  // 状態機械として作られていて、Grid.entriesが空でも安全に動く
  // （moveToAdjacentEntry等はentries.length===0なら即falseを返すだけで
  // 何も壊さない）。そのため新しく作るのは「どの記事が選択中か」という
  // 状態と、その記事から画像等を抜き出す処理だけで、開閉・A/D送りは
  // renderSubgrid()/renderViewer()/step()/closeOverlayLevel()をそのまま流用する。
  // ============================================================
  const NativeNav = { el: null };

  function scrapeNativeEntry(cell) {
    if (!cell || !cell.querySelector('article')) return null;
    const linkEl = cell.querySelector('a[role="link"][href*="/status/"]');
    const href = linkEl ? linkEl.getAttribute('href') : null;
    const photoImgs = cell.querySelectorAll('[data-testid="tweetPhoto"] img');
    const avatarImg = cell.querySelector('[data-testid="Tweet-User-Avatar"] img');
    const nameEl = cell.querySelector('[data-testid="User-Name"]');
    const textEl = cell.querySelector('[data-testid="tweetText"]');
    return {
      type: photoImgs.length > 0 ? 'photo' : 'text',
      href,
      images: Array.from(photoImgs).map((img) => img.src),
      avatar: avatarImg ? avatarImg.src : '',
      name: nameEl ? nameEl.textContent : '',
      text: textEl ? textEl.textContent : '',
    };
  }

  function nativeCells() {
    return [...document.querySelectorAll('[data-testid="primaryColumn"] [data-testid="cellInnerDiv"]')].filter((c) =>
      c.querySelector('article')
    );
  }

  function nativeSetSelection(cell) {
    if (NativeNav.el) NativeNav.el.classList.remove('xmr-native-sel');
    NativeNav.el = cell || null;
    if (cell) {
      cell.classList.add('xmr-native-sel');
      cell.scrollIntoView({ block: 'center', behavior: 'auto' });
    }
  }

  function isStatusPage() {
    return /^\/[^/]+\/status\/\d+/.test(location.pathname);
  }

  // Rキーでツイートを新しいタブで開いた時、そのポストを1回Qで選択しないと
  // 2/3キーでいいね/ブックマークができなかった（いいね等はpressActionButton()
  // 経由でNativeNav.elを見るため）。実機報告を受けて、ツイート単体ページ
  // （常にメインの投稿が1件だけ）では最初から自動で選択しておく。他のページ
  // （複数の投稿が並ぶタイムライン等）では意図しない選択にならないよう対象外。
  async function autoFocusStatusPage() {
    if (!isStatusPage()) return;
    const token = Grid.navToken;
    const cell = await waitFor(() => nativeCells()[0], 4000, 60);
    if (!cell || token !== Grid.navToken) return;
    if (!isStatusPage() || currentGridMode() || NativeNav.el) return;
    nativeSetSelection(cell);
  }

  function nativeSelectDelta(delta, cells) {
    cells = cells || nativeCells();
    if (cells.length === 0) return;
    const idx = NativeNav.el ? cells.indexOf(NativeNav.el) : -1;
    const next = idx < 0 ? (delta > 0 ? 0 : cells.length - 1) : Math.max(0, Math.min(cells.length - 1, idx + delta));
    nativeSetSelection(cells[next]);
  }

  function nativeOpenSelected() {
    if (!NativeNav.el) return;
    const entry = scrapeNativeEntry(NativeNav.el);
    if (!entry || entry.type !== 'photo' || entry.images.length === 0) return;
    if (entry.images.length > 1) {
      Grid.subEntry = entry;
      Grid.subImages = entry.images;
      Grid.subSelIndex = 0;
      renderSubgrid();
    } else {
      Grid.viewList = [entry];
      Grid.viewIndex = 0;
      renderViewer();
    }
  }

  // グリッド表示中(Grid.active)はグリッド専用のキー処理に任せるので、こちらは
  // Grid.active===falseのときだけ動く。オーバーレイが開いている間はQ/Esc/A/Dを
  // 中の画像操作に、開いていなければW/Sを記事選択、Qを「開く」に割り当てる。
  document.addEventListener('keydown', (e) => {
    if (Grid.active) return;
    if (isTypingTarget(e.target)) return;
    const overlayOpen = Grid.overlay && Grid.overlay.classList.contains('xmr-open');
    const k = e.key.toLowerCase();

    // いいね/ブックマークは、画像を開いていてもW/Sで選択しているだけでも
    // どちらでも使えるようにする（開かないと押せないのは不便なため）。
    if (k === Settings.keys.like) {
      e.preventDefault();
      pressActionButton(['like', 'unlike']);
      return;
    }
    if (k === Settings.keys.bookmark) {
      e.preventDefault();
      pressActionButton(['bookmark', 'removeBookmark']);
      return;
    }
    if (k === Settings.keys.reply) {
      e.preventDefault();
      openReplyComposer();
      return;
    }
    if (k === Settings.keys.retweet) {
      e.preventDefault();
      pressRetweet();
      return;
    }

    if (overlayOpen) {
      if (k === Settings.keys.openClose || e.key === 'Escape') {
        e.preventDefault();
        closeOverlayLevel();
      } else if (k === Settings.keys.moveRight || e.key === 'ArrowRight') {
        e.preventDefault();
        step(1);
      } else if (k === Settings.keys.moveLeft || e.key === 'ArrowLeft') {
        e.preventDefault();
        step(-1);
      }
      return;
    }

    if (
      k !== Settings.keys.moveDown &&
      k !== Settings.keys.moveUp &&
      k !== Settings.keys.openClose &&
      e.key !== 'ArrowDown' &&
      e.key !== 'ArrowUp'
    )
      return;
    const cells = nativeCells();
    if (cells.length === 0) return; // タイムラインが無いページ（設定等）では何もしない

    if (k === Settings.keys.moveDown || e.key === 'ArrowDown') {
      e.preventDefault();
      nativeSelectDelta(1, cells);
    } else if (k === Settings.keys.moveUp || e.key === 'ArrowUp') {
      e.preventDefault();
      nativeSelectDelta(-1, cells);
    } else if (k === Settings.keys.openClose) {
      e.preventDefault();
      if (!NativeNav.el) nativeSelectDelta(1, cells);
      else nativeOpenSelected();
    }
  });

  // ============================================================
  // 機能7: プロフィールページでGキーを押すとそのアカウントのメディア欄へ直接移動
  // ============================================================
  function isProfileRootPage() {
    // ホーム・通知・検索等の予約済みルートはプロフィールではないので除外
    const reserved = /^\/(home|i|explore|notifications|messages|settings|compose|search)(\/|$)/;
    if (reserved.test(location.pathname)) return false;
    return (
      /^\/[^/]+\/?$/.test(location.pathname) || /^\/[^/]+\/(with_replies|highlights)\/?$/.test(location.pathname)
    );
  }

  document.addEventListener('keydown', (e) => {
    if (isTypingTarget(e.target)) return;
    if (e.key.toLowerCase() !== Settings.keys.profileToMedia) return;
    if (Grid.overlay && Grid.overlay.classList.contains('xmr-open')) return;
    if (!isProfileRootPage()) return;
    const username = location.pathname.split('/')[1];
    if (!username) return;
    e.preventDefault();
    // Xは"g"を「次に押すキーで移動先を決める」プレフィックスとして使っている
    // （g→h でホーム等）。同じ"g"に別の意味を割り当てているため、Xの本来の
    // ハンドラにもこのキーが渡って変な状態変化を起こさないよう止めておく。
    e.stopImmediatePropagation();
    history.pushState(null, '', '/' + username + '/media');
    window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
  });

  // ============================================================
  // 機能7b: ホームへ1キーで戻る（新しいタブは開かない）
  // 「そのページで見たいものは全部見たのでTLに戻りたい」時用。本物の
  // 「ホーム」ナビアイコンへclick()を委譲するだけなので、同じタブ内で
  // 普通にリンクを踏んだのと同じ遷移になる（新しいタブは開かない）。
  // ホームに既にいる時にクリックすると、上のクリックリスナー
  // （「本物のホームナビアイコンは…」参照）が拾って更新処理につながる
  // ため、「ホームで1を押す」＝更新、という自然な挙動にもなる。
  // ============================================================
  document.addEventListener('keydown', (e) => {
    if (isTypingTarget(e.target)) return;
    if (e.key.toLowerCase() !== Settings.keys.goHome) return;
    if (Grid.overlay && Grid.overlay.classList.contains('xmr-open')) return;
    if (document.querySelector('[role="menu"]')) return; // 「•••」メニュー操作中は無視
    const homeLink = document.querySelector('[data-testid="AppTabBar_Home_Link"]');
    if (!homeLink) return;
    e.preventDefault();
    homeLink.click();
  });

  // ============================================================
  // 機能8: 通常のタイムライン（グリッド未使用時）でも既読トラッキングを行う
  //
  // 既読情報自体はグリッド用と完全に共有（同じlocalStorageのseenTweets）。
  // グリッド側は更新/ホーム移動等の明示的な区切りでスナップショットする
  // 方式にしたが（画面に映った瞬間に既読登録すると、表示直後から画面内に
  // ある分がその場で既読扱いになってしまう不具合があったため）、通常
  // タイムラインにはグリッドのような明示的な「更新ボタン」が無いため、
  // 代わりに「上端から完全に流れ去った（スクロールで通り過ぎた）」ことを
  // 区切りとして使う。表示された瞬間ではなく、ページの上端(0px)より上に
  // 完全に出た時点で既読登録するので、初回表示直後に画面内にあるだけの
  // ものが即既読になることはない。
  function scanNativeSeen() {
    if (Grid.active) return; // グリッド表示中は自前タイル側の既読トラッキングに任せる
    for (const cell of nativeCells()) {
      const linkEl = cell.querySelector('a[role="link"][href*="/status/"]');
      const id = tweetIdFromHref(linkEl ? linkEl.getAttribute('href') : null);
      if (!id) continue;
      if (loadSeenTweets().has(id)) {
        cell.classList.add('xmr-native-seen'); // 既に既読なら即座に色を付ける
        continue;
      }
      if (cell.dataset.xmrNativeSeenChecked) continue;
      const rect = cell.getBoundingClientRect();
      if (rect.bottom >= 0) continue; // まだ画面内〜下にある。完全に上へ流れ去るまで待つ
      cell.dataset.xmrNativeSeenChecked = '1';
      loadSeenTweets().add(id);
      saveSeenTweetsSoon();
      cell.classList.add('xmr-native-seen');
    }
  }
  // 仮想リストは常に新しいセルが出入りするので、他の軽量なポーリング
  // (onUrlChangeのURL監視等)と同じ考え方で定期スキャンする。対象は現在
  // 画面上にマウントされているセルだけなので毎回のコストは小さい。
  setInterval(scanNativeSeen, 800);

  // --- 自前タイルの生成（Xの実DOMは一切再利用しない。srcの文字列だけコピーする） ---
  //
  // app.htmlの「画像の下に小さい帯（投稿者・本文・アイコン）」というデザインに
  // 合わせて、写真タイルにも画像の下に同じ帯を付ける（本文が無ければ帯は
  // 空のグレーのまま）。テキストのみのエントリ（画像なし）は元々この帯と
  // 同じ内容（アバター・名前・本文）だけで構成されているので、画像エリアを
  // 省いて帯の内容がタイル全体を占める形にする。
  function makeBand(entry) {
    const band = document.createElement('div');
    band.className = 'xmr-tile-band';
    const author = tweetAuthorFromHref(entry.href);
    // 帯クリックで新しいタブへ飛ぶ動作は「邪魔」との指摘で撤去した。
    // 帯をクリックした場合も含め、タイル全体のクリックはmakeTile()側の
    // ハンドラ（選択してactivateSelected()）にそのまま委ねる。
    if (!entry.name && !entry.text) {
      band.classList.add('xmr-tile-band-empty');
      return band;
    }
    const head = document.createElement('div');
    head.className = 'xmr-tile-head';
    const avatar = document.createElement('img');
    avatar.className = 'xmr-tile-avatar';
    if (entry.avatar) avatar.src = entry.avatar;
    else avatar.style.display = 'none'; // アバター不明（検索メディア等）なら空の丸を出さない
    // アバターだけは投稿者のアカウントページへ（帯の他の場所とは別の行き先）
    if (author) {
      avatar.addEventListener('click', (e) => {
        e.stopPropagation();
        xmrSpaNavigate('/' + author); // 同タブSPA遷移（速い・戻りで復元）
      });
    }
    const name = document.createElement('span');
    name.className = 'xmr-tile-name';
    name.textContent = entry.name || '';
    head.appendChild(avatar);
    head.appendChild(name);
    // エンゲージメント数（実機フィードバック「いいね数等の情報がどこにも
    // 無い」への対応）。帯には主要3種をコンパクトに（表示回数はビューア側）。
    // 数字はXの表示文字列そのまま（"1.2万"等）なので加工しない。
    const cts = entry.counts;
    if (cts && (cts.like || cts.rt || cts.reply)) {
      const countsEl = document.createElement('span');
      countsEl.className = 'xmr-tile-counts';
      countsEl.textContent = [
        cts.like ? '♥' + cts.like : '',
        cts.rt ? '🔁' + cts.rt : '',
        cts.reply ? '💬' + cts.reply : '',
      ]
        .filter(Boolean)
        .join(' ');
      head.appendChild(countsEl);
    }
    band.appendChild(head);
    if (entry.text) {
      const body = document.createElement('div');
      body.className = 'xmr-tile-text-body';
      body.textContent = entry.text;
      band.appendChild(body);
    }
    return band;
  }

  function makeTile(entry) {
    const tile = document.createElement('div');
    // デバッグ・実機検証用：このタイルがどのツイートに対応しているかを
    // DOMから直接確認できるようにしておく（拡張の分離ワールド外からは
    // Grid.entriesを読めないため、これが唯一の突き合わせ手段になる）。
    tile.dataset.xmrHref = entry.href || '';
    if (entry.type === 'photo') {
      tile.className = 'xmr-tile xmr-tile-photo' + (entry.isVideo ? ' xmr-tile-isvideo' : '');
      const imageArea = document.createElement('div');
      imageArea.className = 'xmr-tile-image';
      const img = document.createElement('img');
      img.loading = 'lazy';
      img.src = mediumSrc(entry.images[0]);
      imageArea.appendChild(img);
      // マウス派向け：タイルにホバーした時だけ右上に出る小さな操作ボタン列。
      // 設定(tileActions)でON/OFF可能（html.xmr-tile-actions-offクラスで
      // 一括非表示）。クリックはタイル本体（ビューアを開く）に伝播させない。
      // 検索メディア由来のエントリは裏のセルに操作ボタン自体が存在せず
      // 実行不能なので、ボタン列ごと出さない。
      if (!entry.searchItem) {
        const acts = document.createElement('div');
        acts.className = 'xmr-tile-actions';
        const mkAct = (cls, label, title, fn) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'xmr-tile-act ' + cls;
          b.textContent = label;
          b.title = title;
          b.addEventListener('click', (ev) => {
            ev.stopPropagation();
            fn();
          });
          return b;
        };
        const tLike = mkAct('xmr-tile-act-like', '♥', t('titleLikeToggle'), () => actOnEntry(entry, ['like', 'unlike']));
        tLike.classList.toggle('xmr-act-on-like', !!entry.liked);
        const tBm = mkAct('xmr-tile-act-bm', '🔖', t('titleBookmarkToggle'), () => actOnEntry(entry, ['bookmark', 'removeBookmark']));
        tBm.classList.toggle('xmr-act-on-bm', !!entry.bookmarked);
        acts.appendChild(tLike);
        acts.appendChild(tBm);
        const tRt = mkAct('xmr-tile-act-rt', '🔁', t('titleRepostToggle'), () => retweetEntry(entry));
        tRt.classList.toggle('xmr-act-on-rt', !!entry.retweeted);
        acts.appendChild(tRt);
        acts.appendChild(mkAct('xmr-tile-act-reply', '💬', t('titleReply'), () => openReplyComposerForEntry(entry)));
        imageArea.appendChild(acts);
      }
      if (entry.images.length > 1) {
        const badge = document.createElement('div');
        badge.className = 'xmr-multi-badge';
        badge.textContent = '1/' + entry.images.length;
        imageArea.appendChild(badge);
      }
      // 動画の投稿はサムネイル画像だけだと写真と見分けが付かない
      // （実機報告：メディア欄で動画も見えるようにしてほしいという要望を
      // 受けて対応。開いても実際の再生はできず静止画のサムネイルのまま
      // なので、Xの本物のグリッドと同じ再生アイコンだけは出しておく）。
      if (entry.isVideo) {
        const vbadge = document.createElement('div');
        vbadge.className = 'xmr-video-badge';
        vbadge.textContent = '▶';
        // 再生アイコンのクリックでそのポストへ（同タブSPA遷移なので即表示、
        // Xの本物のプレイヤーで再生できる。戻ればグリッドに復帰）。
        // タイル本体のクリック（ビューアを開く）には伝播させない。
        vbadge.addEventListener('click', (ev) => {
          ev.stopPropagation();
          openEntrySameTab(entry, false);
        });
        imageArea.appendChild(vbadge);
      }
      tile.appendChild(imageArea);
      tile.appendChild(makeBand(entry));
    } else {
      tile.className = 'xmr-tile xmr-tile-text';
      tile.appendChild(makeBand({ ...entry, text: entry.text || t('noText') }));
    }
    tile.addEventListener('click', () => {
      Grid.selIndex = Grid.entries.indexOf(entry);
      paintSelection();
      activateSelected();
    });
    entry.tileEl = tile;

    // 既読トラッキング：既に既読リストに入っているものは文字を少し青みがから
    // せる。「今スクロールで画面に映った」瞬間には既読登録しない（実機報告：
    // 初回表示直後、画面内に最初から入っている分がその場で全部既読扱いになり、
    // 「どこまで読んだか」の目印として機能しなかった）。既読への登録自体は
    // 更新/ホーム移動など明示的な区切りのタイミングでmarkAllLoadedAsSeen()が
    // まとめて行う。
    const tweetId = tweetIdFromHref(entry.href);
    if (tweetId && loadSeenTweets().has(tweetId)) {
      tile.classList.add('xmr-tile-seen');
    }
    return tile;
  }

  // --- 裏の本物リストから新規エントリを抽出してグリッドに追加する ---
  //
  // 注意：Xは記事の骨組み（本文・アバター等）を先に描画し、画像
  // (data-testid="tweetPhoto") は数秒遅れて追加されることがある
  // （実機確認：最大で数秒かかるケースを確認済み）。そのためこの瞬間に
  // 画像が無くても即「テキストのみ」と確定せず、CONFIG.photoPendingMs の
  // 間は保留にして再チェックする。保留中は Grid.pending に初回検知時刻を
  // 記録しておき、次のharvestNew呼び出し（MutationObserverや定期タイマー）
  // で画像が現れていないか確認し続ける。
  // 【重要・設計の教訓】並び順の正しさ（translateY順）と、WASD移動中の
  // 安定性は、単純には両立しない。挿入のたびに配列の途中へ差し込む方式
  // （旧insertEntrySorted）は、ユーザーがWASDで操作している最中にも
  // バックグラウンドの読み込みで発火し、既に見えているタイルの位置を
  // 次々とずらしてしまい、「Sキーを押しているだけで列がずれる」という
  // 実機報告（最悪の体験、との言葉通り）につながった。
  // 対策：通常は常に末尾へ追加するだけ（＝既存のタイルの位置は絶対に
  // 動かさない）。並び順の補正は、ユーザーがまだ操作していないタイミング
  // （初回表示・更新直後の一括読み込み完了時）にsettleGridOrder()で
  // 1回だけまとめて行う。
  function appendEntry(entry, ty) {
    entry.ty = ty;
    Grid.entries.push(entry);
    const tile = makeTile(entry);
    Grid.gridEl.appendChild(tile);
    // タイルの<img>はloading=lazyのため、画面接近まで画像取得が始まらず
    // 高速スクロール時に白タイルが見える一因だった。取り込んだ時点で
    // HTTPキャッシュへ先行ロードしておく（同一URLなのでlazy側は表示時に
    // キャッシュヒットするだけ。DOMには追加しないので描画コストも無い）。
    if (entry.type === 'photo' && entry.images && entry.images[0]) {
      const pre = new Image();
      pre.src = mediumSrc(entry.images[0]);
    }
  }

  // 初回表示・更新直後の一括読み込みが終わったタイミングで1回だけ呼ぶ。
  // 既存のタイルDOM要素を再利用したままtranslateY順に並べ直す
  // （appendChildは既にDOMに繋がっている要素を新しい位置へ「移動」させる
  // ので、要素を作り直す必要はない）。ユーザーがまだ操作していない
  // 前提の処理なので、選択位置(selIndex)は0のまま据え置いてよい。
  function settleGridOrder() {
    if (!Grid.gridEl || Grid.entries.length === 0) return;
    Grid.entries.sort((a, b) => a.ty - b.ty);
    const frag = document.createDocumentFragment();
    for (const entry of Grid.entries) {
      if (entry.tileEl) frag.appendChild(entry.tileEl);
    }
    Grid.gridEl.appendChild(frag);
  }

  function translateYOf(c) {
    const m = (c.style.transform || '').match(/translateY\(([-\d.]+)px\)/);
    return m ? parseFloat(m[1]) : 0;
  }

  // セルからエンゲージメント数（リプ/リポスト/いいね/表示回数）を読み取る。
  // 各ボタンのtextContentは数字表示そのもの（"8"や"1.2万"、0件なら空）なので
  // Xの表示言語に依存しない。表示回数だけはボタンではなく/analyticsへの
  // リンクとして描画される。
  function scrapeCounts(c) {
    const t = (sel) => {
      const el = c.querySelector(sel);
      return el ? el.textContent.trim() : '';
    };
    return {
      reply: t('[data-testid="reply"]'),
      rt: t('[data-testid="retweet"], [data-testid="unretweet"]'),
      like: t('[data-testid="like"], [data-testid="unlike"]'),
      views: t('a[href$="/analytics"]'),
    };
  }

  function harvestNew() {
    if (!Grid.gridEl) return 0;
    if (!ensureSourceRootAlive()) return 0;
    const now = Date.now();
    let added = 0;
    for (const c of Array.from(Grid.sourceRoot.children)) {
      // 検索結果のメディアタブ（mode='search'）は実機DOM検証で特殊構造と
      // 判明：1セル=画像最大3枚の「行」で、<article>もtweetPhotoも投稿者
      // 情報も無く、/status/ID/photo/n へのリンク+<img>が並ぶだけ。
      // 通常の収穫経路とは別に、リンク1つ=1エントリとして取り込む。
      // 投稿者名はhrefから@ハンドルだけ復元できる。いいね等の状態・
      // ボタンはセルに存在しないため取得不能（searchItemフラグで印を
      // 付け、操作系は「開いてから」へ誘導する）。
      // 【重要・実機で確定】検索メディアの仮想リストは約11個のセル要素を
      // 使い回す（スクロールしても同じ要素の中身だけ差し替わる）ため、
      // xmrDone印を付けると「昔の中身の時に付いた印」が新しい中身でも
      // 残り続け、追加読み込み分が永遠にスキップされる。検索モードでは
      // xmrDoneを一切使わず、画像リンク単位のGrid.seen照合だけで重複排除
      // する（セル数は高々十数個なので毎回の全走査コストは無視できる）。
      if (Grid.mode === 'search') {
        const links = c.querySelectorAll('a[href*="/status/"][href*="/photo/"]');
        if (links.length === 0) continue; // スケルトン行。次回また見る
        for (const a of links) {
          const img = a.querySelector('img');
          if (!img || !img.src) continue;
          const photoHref = a.getAttribute('href') || '';
          const href = photoHref.replace(/\/photo\/\d+.*$/, '');
          if (!photoHref || Grid.seen.has(photoHref)) continue;
          Grid.seen.add(photoHref);
          const author = tweetAuthorFromHref(href);
          appendEntry(
            {
              type: 'photo',
              href,
              images: [img.src],
              avatar: '',
              name: author ? '@' + author : '',
              text: '',
              isVideo: img.src.includes('video_thumb'),
              liked: false,
              bookmarked: false,
              retweeted: false,
              searchItem: true, // 検索メディア由来（いいね等の直接操作は構造上不可）
            },
            translateYOf(c)
          );
          added++;
        }
        continue;
      }
      // 確定済み（写真/テキストどちらかに分類し終えた）セルは毎回の走査から即スキップする。
      // 件数が増えるほど毎フレームの全走査コストが効いてくるため（ガクつきの原因）。
      // ※検索モードは上の分岐で処理済み（xmrDoneは使わない）。
      if (c.dataset.xmrDone === '1') continue;
      const article = c.querySelector('article');
      if (!article) continue;
      const linkEl = c.querySelector('a[role="link"][href*="/status/"]');
      const href = linkEl ? linkEl.getAttribute('href') : null;
      const photoImgs = c.querySelectorAll('[data-testid="tweetPhoto"] img');
      const key = href || (photoImgs[0] && photoImgs[0].src);
      if (!key || Grid.seen.has(key)) continue;

      if (photoImgs.length === 0) {
        const firstSeen = Grid.pending.get(key);
        if (firstSeen === undefined) {
          Grid.pending.set(key, now);
          continue; // 初回：画像がまだ描画中かもしれないので次回まで様子見
        }
        if (now - firstSeen < CONFIG.photoPendingMs) continue; // 猶予期間中

        // タイムアウト：本当に画像なしと確定
        Grid.pending.delete(key);
        Grid.seen.add(key);
        c.dataset.xmrDone = '1';
        if (Grid.mode !== 'likes') continue; // メディアタブでは対象外のまま
        const avatarImg = c.querySelector('[data-testid="Tweet-User-Avatar"] img');
        const nameEl = c.querySelector('[data-testid="User-Name"]');
        const textEl = c.querySelector('[data-testid="tweetText"]');
        const entry = {
          type: 'text',
          href,
          avatar: avatarImg ? avatarImg.src : '',
          name: nameEl ? nameEl.textContent : '',
          text: textEl ? textEl.textContent : '',
          // 収穫時点のいいね/ブックマーク状態（セルがマウントされている今なら
          // 読める）。以後は自前のキー/ボタン操作時に更新する。他の端末等で
          // 変えた分までは追わない（そのための再マウントはコストに見合わない）。
          liked: !!c.querySelector('[data-testid="unlike"]'),
          bookmarked: !!c.querySelector('[data-testid="removeBookmark"]'),
          retweeted: !!c.querySelector('[data-testid="unretweet"]'),
          counts: scrapeCounts(c),
        };
        appendEntry(entry, translateYOf(c));
        added++;
        continue;
      }

      Grid.pending.delete(key);
      Grid.seen.add(key);
      c.dataset.xmrDone = '1';
      // 画像の下に付ける帯用に、本文・投稿者も一緒に拾っておく（無ければ帯は空のグレーになる）
      const avatarImg = c.querySelector('[data-testid="Tweet-User-Avatar"] img');
      const nameEl = c.querySelector('[data-testid="User-Name"]');
      const textEl = c.querySelector('[data-testid="tweetText"]');
      // 動画の投稿も[data-testid="tweetPhoto"] imgを持っている（中身はサムネイル
      // 画像=video_thumb）ため、ここまでは写真と全く同じ経路で拾える。タイルに
      // 再生アイコンを出すためだけに、動画かどうかを覚えておく。
      const isVideo = !!c.querySelector('[data-testid="videoPlayer"], [data-testid="videoComponent"]');
      const entry = {
        type: 'photo',
        href,
        images: Array.from(photoImgs).map((img) => img.src),
        avatar: avatarImg ? avatarImg.src : '',
        name: nameEl ? nameEl.textContent : '',
        text: textEl ? textEl.textContent : '',
        isVideo,
        // 収穫時点のいいね/ブックマーク/リポスト状態（詳細はtext側のコメント参照）
        liked: !!c.querySelector('[data-testid="unlike"]'),
        bookmarked: !!c.querySelector('[data-testid="removeBookmark"]'),
        retweeted: !!c.querySelector('[data-testid="unretweet"]'),
        counts: scrapeCounts(c),
      };
      appendEntry(entry, translateYOf(c));
      added++;
    }
    return added;
  }

  // pumpMore用の適応的な待ち：裏のリストに新しいセルが追加(childList)されたら
  // 即座に次のステップへ進む。来なければmaxMsで諦めて進む（従来の固定300ms
  // 相当のフォールバック）。minMsは「Xがマウント処理を終えるまでの猶予」の
  // 下限で、スクロール1回ごとに必ずこれだけは待つ（早回しのしすぎで実質
  // 大ジャンプ相当になりセルを取りこぼすことを防ぐ安全弁。設計原則6）。
  // 注意：このMutationObserverはsourceRoot限定・childListのみ・コールバックは
  // Promiseのresolveだけ（DOMへの書き込み無し）なので、bodyObserverの無限
  // ループ問題（設計原則3）は起こさない。attributes:trueは絶対に足さないこと
  // （harvestNewがdataset.xmrDoneを書くため、足すとループする）。
  // 実機検証で判明した落とし穴：subtree:trueで「何かしらのchildList変化」を
  // シグナルにすると、セルのアンマウントやセル内部の描画変化でも即resolve
  // してしまい、ステップが速く回りすぎて「新着なし(stagnant)×10回」の判定が
  // 従来の約3秒から約1秒に縮み、Xのネットワーク読み込み(1〜3秒)を待ちきれず
  // に初回読み込みが13枚程度で打ち切られる退行が出た。シグナルは
  // 「sourceRoot直下に新しいセルが追加された(addedNodes)」だけに限定する。
  function waitForSourceGrowth(minMs, maxMs) {
    const grew = new Promise((resolve) => {
      if (!Grid.sourceRoot) return resolve();
      let t = null;
      const mo = new MutationObserver((mutations) => {
        if (!mutations.some((m) => m.addedNodes.length > 0)) return; // 削除や無関係な変化では起きない
        mo.disconnect();
        if (t) clearTimeout(t);
        resolve();
      });
      mo.observe(Grid.sourceRoot, { childList: true });
      t = setTimeout(() => {
        mo.disconnect();
        resolve();
      }, maxMs);
    });
    return Promise.all([grew, sleep(minMs)]);
  }

  // --- 裏のリストを自分でスクロールさせ、Xの無限読み込みを誘発する ---
  async function pumpMore(targetCount) {
    if (Grid.pumping) return;
    const token = Grid.navToken;
    Grid.pumping = true;
    if (Grid.loadingEl) Grid.loadingEl.style.display = 'block';
    // 「これ以上読み込んでも増えない」の判定は、以前は「増えないステップが
    // 10回連続」だったが、待ち時間を適応化した結果1ステップの所要が状況で
    // 変わるようになった（既読み込み済み領域の通過は約100ms、読み込み待ちは
    // 300ms）ため、回数ベースだと打ち切りまでの実時間がぶれる。エントリが
    // 最後に増えてからの経過時間（4秒）で判定する時間ベースに変更。
    const stagnantGiveUpMs = 4000;
    let lastGrowthAt = Date.now();
    let lastLen = Grid.entries.length;
    // 【重要・実機で確定した重大バグ】一気に最下部(document.documentElement.
    // scrollHeight)までジャンプする方式だと、Xの仮想リストが跳び越えた
    // 範囲のセルをそもそもマウントせず、その投稿が丸ごと抜け落ちることが
    // ユーザーの実機比較で確定した（例：3/27の次の投稿が2件（2/2, 1/27）
    // 丸ごと欠落し、いきなり12月の投稿まで飛んでいた）。「画像のみ表示を
    // OFFにして手でゆっくりスクロールしてからONにする」と正しく全部
    // 拾えていたことから、大ジャンプではなく1画面分ずつ進める方式に変更する。
    for (let i = 0; i < 80 && Grid.entries.length < targetCount && Date.now() - lastGrowthAt < stagnantGiveUpMs; i++) {
      if (token !== Grid.navToken || !Grid.active) break;
      window.scrollBy(0, Math.round(window.innerHeight * 0.8));
      // 実機報告「スクロール時のロードが0.3秒くらい遅い」への対応：以前は
      // ここで固定sleep(300)していたが、Xが既にデータを持っていて数十msで
      // 新セルをマウントできる場合でも300ms待っていた（体感の0.3秒は
      // 文字通りこれ）。300msという数字自体に並び順保証の意味は無い
      // （順序は末尾追加＋translateYで担保）ので、「新セルが来たら即続行、
      // 来なければ従来通り300msで諦める」適応待ちに変更。
      await waitForSourceGrowth(CONFIG.pumpStepMinWaitMs, CONFIG.pumpStepMaxWaitMs);
      if (token !== Grid.navToken || !Grid.active) break;
      harvestNew();
      if (Grid.entries.length !== lastLen) lastGrowthAt = Date.now();
      lastLen = Grid.entries.length;
    }
    if (token === Grid.navToken) {
      Grid.pumping = false;
      if (Grid.loadingEl) Grid.loadingEl.style.display = 'none';
    }
  }

  function maybePumpNearEnd() {
    if (!Grid.active) return;
    // 先読み開始の閾値。以前は固定12件（5列で約2.4行）だったが、追加読み込みが
    // 体感で「間に合っていない」との報告を受けて約4行分に拡大。
    if (Grid.entries.length - Grid.selIndex < CONFIG.gridCols * 4) {
      pumpMore(Grid.entries.length + CONFIG.pumpBatchCount);
    }
  }

  // 「既読」は継続的な可視性トラッキングではなく、更新／ホーム移動／他のページへの
  // 遷移など「ここで一区切り」というタイミングでスナップショットする方式にした
  // （実機報告：画面に映った瞬間に既読登録する方式だと、グリッド表示直後から
  // 画面内にある分が即座に既読扱いになり、「どこまで読んだか」の目印として
  // 機能しなかった）。今読み込んでいる分を丸ごと既読リストに追加する。
  function markAllLoadedAsSeen() {
    let changed = false;
    // Grid.maxSeenIndexより後ろ（＝WASD等でまだ到達していない、先読みされた
    // だけの分）は対象外にする。
    for (let i = 0; i <= Grid.maxSeenIndex && i < Grid.entries.length; i++) {
      const id = tweetIdFromHref(Grid.entries[i].href);
      if (id && !loadSeenTweets().has(id)) {
        loadSeenTweets().add(id);
        changed = true;
      }
    }
    if (changed) saveSeenTweetsSoon();
  }

  // --- グリッド起動／終了 ---
  // 同タブSPA遷移で他ページへ行って戻ってきた時に、読み込み直しゼロで
  // 元の位置ごと復元するためのスナップショット置き場。href → 状態。
  // R/Fの同タブ化とセットの機能（戻る操作でXネイティブに負けないための要）。
  const GridCache = new Map();
  const GRID_CACHE_TTL_MS = 10 * 60 * 1000; // 古いスナップショットは新鮮に読み直す
  const GRID_CACHE_MAX = 8;

  function deactivateGrid() {
    markAllLoadedAsSeen(); // 他ページへ移動する＝ここで一区切り
    if (Grid.active && Grid.activeHref && Grid.entries.length > 0 && Grid.shellEl) {
      // キーはURL+スコープ。ホームはタブ（おすすめ/フォロー中/リスト）ごとに
      // URLが同じなため、スコープを混ぜないと別タブのスナップショットを
      // 取り違える（実機報告：タブを切り替えても内容が変わらないバグの一部）。
      const cacheKey = Grid.activeHref + '::' + (Grid.homeScope || '');
      GridCache.delete(cacheKey); // 入れ直して挿入順を最新にする(LRU代わり)
      GridCache.set(cacheKey, {
        mode: Grid.mode,
        entries: Grid.entries,
        seen: Grid.seen ? [...Grid.seen] : [],
        selIndex: Grid.selIndex,
        maxSeenIndex: Grid.maxSeenIndex,
        scrollTop: Grid.shellEl.scrollTop,
        savedAt: Date.now(),
      });
      while (GridCache.size > GRID_CACHE_MAX) {
        GridCache.delete(GridCache.keys().next().value);
      }
    }
    Grid.navToken++;
    if (Grid.sourceObserver) Grid.sourceObserver.disconnect();
    Grid.sourceObserver = null;
    if (Grid.pendingTimer) clearInterval(Grid.pendingTimer);
    Grid.pendingTimer = null;
    if (Grid.newPostsTimer) clearInterval(Grid.newPostsTimer);
    Grid.newPostsTimer = null;
    Grid.newPostsBtn = null;
    if (Grid.sourceRoot) Grid.sourceRoot.classList.remove('xmr-source-hidden');
    Grid.sourceRoot = null;
    document.querySelector('[data-testid="sidebarColumn"]')?.classList.remove('xmr-sidebar-hide');
    if (Grid.shellResizeHandler) window.removeEventListener('resize', Grid.shellResizeHandler);
    Grid.shellResizeHandler = null;
    if (Grid.shellEl) Grid.shellEl.remove();
    Grid.shellEl = null;
    Grid.gridEl = null;
    Grid.loadingEl = null;
    Grid.refreshStatusEl = null;
    Grid.entries = [];
    Grid.seen = null;
    Grid.pending = null;
    Grid.active = false;
    Grid.mode = null;
    Grid.activeHref = null;
    Grid.pumping = false;
    Grid.filterUnread = false;
    Grid.filterVideoOnly = false;
    Grid.sidebarPeekOpen = false;
    Grid.userHasNavigated = false;
    Grid.activatingMode = null;
    Grid.activatingHref = null;
    if (Grid.overlay) Grid.overlay.classList.remove('xmr-open');
    document.querySelectorAll('.xmr-tablist-hide').forEach((el) => el.classList.remove('xmr-tablist-hide'));
  }

  // ホームの「更新」ボタン：新着を実際に取り込んでからグリッドを作り直す
  // ユーザーが実際に成功している手動の手順（画像のみ表示をOFFにする→ホームで
  // 新着を取り込む→ONに戻す）をそのまま自動化する。裏に隠したままバナーや
  // ホームアイコンをクリックしても新着が反映されないという報告があったため、
  // 一度グリッドを完全に解除して本物のページを可視化した状態で操作する。
  // グリッドを丸ごと解除→再構築すると、その一瞬だけ本物のタイムラインが
  // 見えてしまい「画像のみ表示が(見た目上)勝手にOFFにされる」ように見える
  // 不具合になっていた（設定自体は一度もOFFにしていないのに、という報告の通り）。
  // グリッドの見た目(shell/toolbar)は一切消さず、中身（タイル）だけを
  // 空にして裏のリストから改めて先頭から拾い直す方式に変更した。
  function resetGridEntries() {
    if (!Grid.gridEl) return;
    Grid.gridEl.innerHTML = '';
    Grid.entries = [];
    Grid.seen = new Set();
    Grid.pending = new Map();
    Grid.selIndex = 0;
    Grid.maxSeenIndex = -1; // 新しく読み込み直した分なので、既読の到達位置もリセットする
    Grid.userHasNavigated = false; // 作り直した分なので、並び替えスキップ判定も初期状態に戻す
    Grid.level = 'grid';
    // 実機調査で判明した重大バグ：更新してもXの仮想リストが同じDOM要素を
    // 使い回すことが多く（実際に新着があっても無くても）、それらの要素には
    // 前回のharvestNew()で付けたxmrDone='1'が残ったままだった。harvestNew()は
    // このフラグが付いている要素を「処理済み」として毎回スキップするため、
    // 結果としてグリッドが空っぽのまま（0件）になってしまっていた
    // （実機確認：更新ボタンを押した直後、裏には9件あるのにグリッドのタイルが
    // 0件という状態を再現した）。ここでフラグをリセットしてから拾い直す。
    if (Grid.sourceRoot) {
      for (const c of Grid.sourceRoot.children) delete c.dataset.xmrDone;
    }
    harvestNew();
    paintSelection();
    if (Grid.shellEl) Grid.shellEl.scrollTop = 0;
    // 実機報告：更新直後は裏のリストがまだ空/スケルトンで、この時点の
    // harvestNew()ではGrid.entriesが0件のことがあり、paintSelection()が
    // 何もハイライトできないまま終わっていた（＝青い枠線が「取り残されて」
    // 見える）。pumpMore()で本文が揃った後、settleGridOrder()で並び順を
    // 1回だけ整えてから、もう一度paintSelection()を呼んで確実に一番上
    // （左上）へハイライトを持ってくる。
    pumpMore(CONFIG.initialFillCount).then(() => {
      // 実機報告：読み込み後、正しく左上から始まるのに数秒後にもう一度
      // 左上へリセットされる不具合があった。原因はここ：初期読み込み
      // (pumpMore)が完了するまでの数秒の間にユーザーが既にWASDで操作を
      // 始めていても、この完了時コールバックが無条件にselIndexを0へ
      // 戻していたため。既に操作済み(Grid.userHasNavigated)ならこの
      // 「揃え直し」自体をスキップする（settleGridOrder()がGrid.entriesを
      // 並び替えるため、既にselIndexが指しているエントリの中身まで変わって
      // しまう危険もあり、選択位置のリセットだけでなくこのブロック全体を
      // スキップする必要がある）。以前はGrid.maxSeenIndex>0で判定していたが、
      // これは初期読み込み中のマウススクロール追従(updateSelectionFromScroll)
      // でも上がってしまい、冷起動時のヒントメッセージが勧める「マウス
      // ホイールを一度スクロールしてみてください」を実行しただけでこの
      // 揃え直しがスキップされ、並び順が揃わないまま、という抜け穴が
      // 実機検証で見つかった。WASD/A/D/Spaceでの意図的な操作だけを見る
      // 専用フラグ(userHasNavigated)に切り替えた。
      if (Grid.userHasNavigated) return;
      settleGridOrder();
      Grid.selIndex = 0;
      paintSelection();
    });
  }

  // 新着ピル（「◯◯さんがポストしました」）の検出。実機のMutationObserver
  // 観測で確定した安定シグネチャ：DIV[data-testid="pillLabel"]がピルの
  // ラベルで、クリック対象はその祖先の<button>（言語・文言・数字の有無に
  // 一切依存しない）。以前の「文言や見た目のヒューリスティック」は
  // 引用ツイートのヘッダー等を誤検出するリスクがあり全廃した。
  // ピルの中身（投稿者アバターのURL群）による簡易指紋。ゾンビ判定に使う。
  // 空（画像がまだ無い等）の場合も固定文字列を返し、datasetの真偽判定が
  // 誤って偽にならないようにする。
  function pillContentSig(label) {
    const sig = [...label.querySelectorAll('img')]
      .map((img) => img.getAttribute('src') || '')
      .join('|');
    return sig || '(no-imgs)';
  }

  // 【2026-08-21・実機報告から発見】Xの新着取り込みの本体はこれ。青い楕円の
  // ピル（「〇〇さんがポストしました」）とは別物で、**タイムラインの一番上の
  // セルに現れる四角いボタン**（「56 件のポストを表示」）。ウィンドウが
  // 一番上にある時だけ仮想リストに現れる。ピルと違い**合成クリックが普通に
  // 効き**、押すとその件数分が先頭に合流する（実機確認：先頭が9時間前の
  // 投稿から1時間前の投稿に入れ替わり、バーも消えた）。
  // 検出は言語非依存の構造で行う：先頭のcellInnerDivで、articleを含まず
  // （＝ツイートではない）、短いテキストのボタンを1つ持つセル。
  function findNewPostsBar() {
    const pc = document.querySelector('[data-testid="primaryColumn"]');
    if (!pc) return null;
    const cell = pc.querySelector('[data-testid="cellInnerDiv"]');
    if (!cell || cell.querySelector('article')) return null;
    const m = (cell.style.transform || '').match(/translateY\(([-\d.]+)px\)/);
    if (m && parseFloat(m[1]) > 10) return null; // 本当に先頭のセルか
    const btn = cell.querySelector('button, [role="button"]');
    if (!btn) return null;
    const txt = (btn.textContent || '').trim();
    if (!txt || txt.length > 40) return null; // 別のモジュール（おすすめ等）を誤爆しない
    return btn;
  }

  function findNewPostsPillButton(primary) {
    // 【実機で確定した罠】Xは非表示中のタブ（フォロー中等）のタイムラインも
    // DOMに保持しており、そちらにもpillLabelが存在し得る。当初は
    // 「矩形サイズ>0＝表示中」で判別していたが、本物のピルはXのタブヘッダー
    // 内にあり、グリッド表示中はそれをこちらが.xmr-tablist-hide（display:none）
    // で隠しているため本物まで矩形0になる（＝本物を弾いてしまい「押しても
    // 読み込まれない」の一因）ことが実機で確認された。判別は
    // 「display:noneの祖先があるか。ただしそれが自前の.xmr-tablist-hideなら
    // 隠れていても本物なのでセーフ」とする。非表示タブのタイムラインは
    // X側のdisplay:noneで畳まれるので従来どおり除外できる。
    const labels = (primary || document).querySelectorAll('[data-testid="pillLabel"]');
    for (const label of labels) {
      // 【実機で確定・ゾンビピル】ホームリンク経由でTLを更新してもピル要素は
      // DOMに残り続けることがある（TL入れ替わり＋青ドット消灯後も残留を確認）。
      // 更新完了時に「その時点の中身の指紋」を付けて消化済み扱いにし、検出から
      // 外す。Xが同じ要素を使い回して次の新着を告知する可能性に備え、指紋
      // （投稿者アバターのURL群）が変わっていたら新しい告知として拾い直す。
      if (label.dataset.xmrStalePill && label.dataset.xmrStalePill === pillContentSig(label)) continue;
      const btn = label.closest('button, [role="button"]');
      if (!btn) continue;
      // 【実機で確定・v3.66】Xはピルを「格納状態」でもDOMに置いている：
      // ボタンにaria-hidden="true"、[role="status"]ラッパーがopacity:0、
      // アバター画像0個。この状態はユーザーには見えず、トラステッドの
      // 上スクロールでも降りてこない＝押しようがない。表示状態（実際に
      // 告知中）のピルだけを新着シグナルとして扱う。
      if (btn.getAttribute('aria-hidden') === 'true') continue;
      const statusWrap = btn.closest('[role="status"]');
      if (statusWrap && parseFloat(getComputedStyle(statusWrap).opacity) === 0) continue;
      let hidden = false;
      for (let n = btn; n && n !== document.documentElement; n = n.parentElement) {
        if (
          getComputedStyle(n).display === 'none' &&
          !(n.classList && n.classList.contains('xmr-tablist-hide'))
        ) { hidden = true; break; }
      }
      if (!hidden) return btn;
    }
    return null;
  }

  async function refreshHomeTimeline() {
    if (Grid.refreshing) return;
    Grid.refreshing = true;
    markAllLoadedAsSeen(); // 更新＝ここで一区切り（新着を読み込む前に今の分を既読にする）
    // 更新中であることが見た目で分かるように表示する。以前はグリッド下部の
    // 読み込み中表示(Grid.loadingEl)を流用していたが、更新中はまだ上の方を
    // 見ている（＝画面外）ことが多く気付きにくいという指摘があったため、
    // 常にスクロール位置に関係なく見えるツールバー（sticky）側の専用要素に変更。
    if (Grid.refreshStatusEl) Grid.refreshStatusEl.textContent = t('refreshing');
    // 【2026-08-21の実機検証で確定した真因】Xのホームボタンは2段構えで、
    // 「下にスクロールしている時は一番上へ戻るだけ／既に一番上にいる時に
    // 初めて新着を取り込む」という挙動をする。グリッド表示中はタイルを
    // 集めるためにウィンドウを深く（実測17000px）スクロールしたままなので、
    // ユーザーが本物のホームボタンを押しても「上へ戻る」だけで終わり、
    // 取り込みまで進まない。これが「画像のみ表示OFFなら効くのにONだと
    // 効かない」「新着ボタンが消えない」の正体だった（従来はクリックしてから
    // scrollTo(0,0)という逆順だったため、常にこの罠を踏んでいた）。
    // 先に一番上へ戻し、Xが「もう上にいる」と認識してからクリックする。
    // これで新着の取り込みが実際に起きることを実機確認済み（新着ボタンの
    // 中身が別のものに入れ替わる＝消化されたことを指紋で確認）。
    const token = Grid.navToken;
    const primary = document.querySelector('[data-testid="primaryColumn"]');
    const homeLink = document.querySelector('[data-testid="AppTabBar_Home_Link"]');
    const cellSelector = '[data-testid="primaryColumn"] [data-testid="cellInnerDiv"]';
    window.scrollTo(0, 0);
    // 一番上に着くまで待つ（実測では上端でもscrollYが50前後残る）。ここで
    // 上に戻すのは「新着取り込みバー」が仮想リストに現れるのが最上部の時
    // だけだから。
    for (let i = 0; i < 20 && window.scrollY > 80; i++) await sleep(100);
    await sleep(400);
    // レース対策の指紋：Xが新TLをfetchし終えるまで1〜2秒かかる。先頭ツイートの
    // 入れ替わりを待たずに組み直すと「更新したのに同じ内容」になる（実機で
    // 確定した過去バグ）。指紋は**上に戻した後**に取る。深くスクロールした
    // 位置で取ると、上に戻しただけで別のツイートになり「入れ替わった」と
    // 誤判定して待ちが空回りする（実機計測：再構築まで14秒かかっていた）。
    const topLink0 = document.querySelector(cellSelector + ' article a[href*="/status/"]');
    const srcTopBefore = topLink0 ? topLink0.getAttribute('href') : null;
    // 取り込みバーは押すと消えるが、Xがすぐ次のバーを出すこともある。
    // 「押せたかどうか」で待ち方を変えるためにここで記録する。
    // 本命：新着取り込みバーがあれば押す。これが「◯件を表示」の正規の
    // 取り込みで、告知された分がそのまま先頭に合流する。
    let bar = findNewPostsBar();
    if (!bar) {
      // バーが出ていない＝Xがまだ新着を用意していないか、そもそも新着なし。
      // ホームリンク経由でタイムラインを引き直させ、その結果バーが出てきたら
      // 押す（実機では引き直し後にバーが現れるケースがある）。
      if (homeLink) homeLink.click();
      for (let i = 0; i < 8 && !bar; i++) {
        await sleep(250);
        bar = findNewPostsBar();
      }
    }
    const barClicked = !!bar;
    if (bar) {
      bar.click();
      await sleep(500); // 合流の描画が始まるまで少し待つ
    }
    for (let i = 0; i < 40; i++) {
      await sleep(300);
      if (token !== Grid.navToken) break;
      // 【実機で発見したバグ】先頭セルは必ずツイートだと決め打ちしていたが、
      // 新着取り込みバー（articleを持たない）が先頭に居座ると毎回この行で
      // continueし、ループが40回×300ms＝12秒空回りして「更新中…」が
      // 終わらなかった。ツイートを持つ最初のセルを探す形にする。
      let candidate = null;
      for (const c of document.querySelectorAll(cellSelector)) {
        if (c.querySelector('article')) { candidate = c; break; }
      }
      if (!candidate) continue;
      const m = (candidate.style.transform || '').match(/translateY\(([-\d.]+)px\)/);
      const ty = m ? parseFloat(m[1]) : 0;
      if (ty < 400) {
        // 位置が整っていても先頭が入れ替わるまで待つ（最大3秒。新着ゼロで
        // 本当に同じ可能性もあるため無限には待たない。バーを押せた場合は
        // 合流済みなのですぐ抜ける）。
        const tl = candidate.querySelector('article a[href*="/status/"]');
        const topNow = tl ? tl.getAttribute('href') : null;
        // バーを押せた時は合流が確定しているので、先頭の入れ替わりを
        // 短く待つだけでよい（押せなかった時だけ引き直しの完了を長めに待つ）。
        const limit = barClicked ? 4 : 10;
        if (!srcTopBefore || (topNow && topNow !== srcTopBefore) || i >= limit) break;
      } else {
        window.scrollTo(0, 0);
        // 仮想リスト停止（scrollToで直らずty>=400が続く）時だけの最後の保険。
        // 通常の更新でリロードは絶対にしない（実機フィードバック）。
        if (i === 10 && tryResyncReload()) return;
      }
    }
    Grid.refreshing = false;
    if (Grid.refreshStatusEl) Grid.refreshStatusEl.textContent = '';
    if (token !== Grid.navToken) return; // その間に他のページへ移動していたら何もしない
    if (Grid.active && Grid.mode === 'home') {
      resetGridEntries();
      // 取り込み済みのピルは「消化済み」として印を付け、以後のバナー判定から
      // 外す（Xはピル要素をDOMに残し続けるため）。
      const pc2 = document.querySelector('[data-testid="primaryColumn"]');
      if (pc2) {
        for (const l of pc2.querySelectorAll('[data-testid="pillLabel"]')) {
          l.dataset.xmrStalePill = pillContentSig(l);
        }
      }
      // 【実機で確定・重要】青ドットは、取り込みバーを押して29件を実際に
      // 合流させても一度も消えない（0.5秒刻み×20回すべて点灯を観測）。
      // 新着が絶え間なく届くフィードでは、ドットもピルも数秒で復活するため、
      // これらをそのままバナーの条件にすると「押しても消えない＝壊れている」
      // としか見えない（実機報告：「消えた瞬間がないわけ」）。
      // 更新が完了したら一定時間バナーを黙らせ、「取り込んだ」ことが目で
      // 分かるようにする。この間に届いた分は次の点灯で拾える。
      Grid.bannerSnoozeUntil = Date.now() + 90 * 1000;
    }
  }

  // 本物の「ホーム」ナビアイコンは、グリッド表示中でも裏では本来の
  // 「一番上へ移動＋新着取り込み」動作をしているはずだが、グリッドは
  // 静的に組み立てた見た目のままなので、その結果が画面に一切反映されず
  // 「押しても何も起きない」ように見えるという指摘があった。ホームで
  // グリッド表示中に本物のホームアイコンが押されたら、更新ボタンと
  // 同じ処理を割り込ませる。
  document.addEventListener(
    'click',
    (e) => {
      if (!Grid.active || Grid.mode !== 'home' || Grid.refreshing) return;
      const homeLink = e.target.closest && e.target.closest('[data-testid="AppTabBar_Home_Link"]');
      if (!homeLink) return;
      // ユーザーが本物のホームボタンを押した場合も、その時点ではウィンドウが
      // 深くスクロールしているので、Xはその1発目を「一番上へ戻る」に使って
      // しまい取り込みまで進まない（上のコメント参照）。同じ手順
      // （上へ戻す→もう一度クリック）を走らせて必ず取り込ませる。
      refreshHomeTimeline();
    },
    true
  );



  // 検索ボックスの経緯（長い）：
  // (1) v3.28.0で「検索ボックスを含むウィジェットだけ残し兄弟だけ隠す」を
  //     試したが、グリッド本体(.xmr-shell)がposition:fixed; right:0で
  //     ビューポート右端まで不透明に覆う作りだったため、隠さず残しても
  //     常にshellの下敷きになり無意味だった。
  // (2) v3.29.0でshellの右端をサイドバーの左端で止めて覆わない方式にした。
  // (3) v3.33.0で検索ウィジェットだけを画面右上にCSS position:fixedで固定
  //     表示する方式（トレンド等の兄弟は隠す）を試したが、ユーザーからの
  //     フィードバックは逆で「表示するなら（検索だけでなく）全部きちんと
  //     表示してほしい／設定自体は残してほしい／ページリロード無しで
  //     トグルできると尚良い」だった。(2)の「隠すか隠さないかの二択、
  //     隠さない時はサイドバーを一切加工しない」方式に戻し、代わりに
  //     トグルボタンをツールバーにも置いて即座に切り替えられるようにした
  //     （hideSidebar設定はchrome.storage経由でoptions.htmlとも同期する）。
  function computeShellRight() {
    if (Settings.hideSidebar && !Grid.sidebarPeekOpen) return 0;
    const sc = document.querySelector('[data-testid="sidebarColumn"]');
    if (!sc || sc.classList.contains('xmr-sidebar-hide')) return 0;
    const rect = sc.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    return Math.max(0, Math.round(window.innerWidth - rect.left));
  }

  // 設定ページでの変更（chrome.storage.onChanged経由）が来た時に、既に
  // 表示中のグリッドへページリロード無しでその場に反映する。
  function applySidebarVisibility() {
    closeSidebarPeek(); // 設定が変わったら一時的な検索ピークは意味が無いので閉じる
    const sidebarEl = document.querySelector('[data-testid="sidebarColumn"]');
    if (sidebarEl) {
      if (Settings.hideSidebar) sidebarEl.classList.add('xmr-sidebar-hide');
      else sidebarEl.classList.remove('xmr-sidebar-hide');
    }
    if (Grid.shellEl) Grid.shellEl.style.right = computeShellRight() + 'px';
  }

  // hideSidebar設定がONの間だけ出る「検索」ボタン用。一時的にサイドバーを
  // 表示して検索ボックスへ自動フォーカスする。設定自体(Settings.hideSidebar)は
  // 変えない（一時的な見た目の上書きだけ。Grid.sidebarPeekOpenがtrueの間は
  // computeShellRight()側でも隠さない扱いにする）。
  // 実機報告：検索以外を触ったりページ移動したりしたら次に戻ってきた時は
  // 元通り隠れていてほしい、とのことなので、この状態はどこにも保存しない
  // （グリッドを離れれば自然に消える一時的な状態）。
  async function openSidebarPeek() {
    const sidebarEl = document.querySelector('[data-testid="sidebarColumn"]');
    if (!sidebarEl) return;
    sidebarEl.classList.remove('xmr-sidebar-hide');
    Grid.sidebarPeekOpen = true;
    if (Grid.shellEl) Grid.shellEl.style.right = computeShellRight() + 'px';
    const input = await waitFor(() => sidebarEl.querySelector('[data-testid="SearchBox_Search_Input"]'), 2000, 50);
    if (input && Grid.sidebarPeekOpen) input.focus();
  }

  function closeSidebarPeek() {
    if (!Grid.sidebarPeekOpen) return;
    Grid.sidebarPeekOpen = false;
    const sidebarEl = document.querySelector('[data-testid="sidebarColumn"]');
    if (sidebarEl && Settings.hideSidebar) sidebarEl.classList.add('xmr-sidebar-hide');
    if (Grid.shellEl) Grid.shellEl.style.right = computeShellRight() + 'px';
  }

  // 検索の「範囲」を特定する。「その範囲の外をクリックしたら一時表示を
  // 閉じる」判定に使う。実機確認済み：検索欄は<form>で囲まれており、予測
  // 候補一覧([role="listbox"])もそのform内の兄弟要素として描画される
  // （検索欄そのものの子孫ではない）ため、closest('form')を範囲とする
  // 必要がある。最初は「兄弟が複数ある祖先」というヒューリスティックで
  // 検索欄自体の範囲だけを取っていたが、それだと予測候補をクリックした
  // 瞬間に「検索の外側をクリックした」と誤判定され、一時表示が閉じて
  // クリックした候補への遷移も一緒にキャンセルされてしまっていた
  // （実機報告：予測候補をクリックしてもサイドバーが消えるだけで検索
  // されない）。
  function findSearchWidgetEl(sidebarEl) {
    const searchInput = sidebarEl.querySelector('[data-testid="SearchBox_Search_Input"]');
    if (!searchInput) return null;
    const form = searchInput.closest('form');
    if (form && sidebarEl.contains(form)) return form;
    // フォールバック：formが見つからない場合は従来の「兄弟が複数ある祖先」探索
    let el = searchInput;
    while (el && el.parentElement && el.parentElement !== sidebarEl) {
      if (el.parentElement.children.length > 1) return el;
      el = el.parentElement;
    }
    return null;
  }

  // 検索以外（サイドバーの他のウィジェット、グリッド本体等）をクリックしたら
  // 一時表示を即座に閉じる。検索をかけてページ移動した場合はグリッド自体が
  // 作り直される（Grid.sidebarPeekOpenは新規false）ので、別途ここで扱う必要はない。
  document.addEventListener(
    'mousedown',
    (e) => {
      if (!Grid.sidebarPeekOpen) return;
      const sidebarEl = document.querySelector('[data-testid="sidebarColumn"]');
      const widgetEl = sidebarEl && findSearchWidgetEl(sidebarEl);
      if (!widgetEl || !widgetEl.contains(e.target)) closeSidebarPeek();
    },
    true
  );

  async function activateGrid(mode) {
    // modeだけでなくlocation.hrefも見て早期returnを判定する。同じ'media'
    // モードのまま「画像」⇔「動画」ピルで/media?filter=photoとbare/media
    // を行き来した場合（実機で用意した新機能）、modeの文字列は両方とも
    // 'media'のまま変わらないため、hrefの比較を入れないと2回目以降の
    // 切り替えで再アクティブ化がスキップされ、古い内容が表示され続けて
    // しまう（別アカウントのメディア欄への遷移でも同様の問題になり得る）。
    // ホームはURLが同じままタブだけ変わるため、スコープ（どのタブか）も
    // 一致して初めて「既に表示中」と判定する（実機報告：両タブとも画像のみ
    // 表示ONだとタブを切り替えても内容が変わらないバグの修正）。
    if (
      Grid.active &&
      Grid.mode === mode &&
      Grid.activeHref === location.href &&
      (mode !== 'home' || (currentImageOnlyScope() || '') === Grid.homeScope)
    )
      return;
    // 実機報告：「画像のみ表示on/offを切り替えていないのに、他ページから
    // ホームへ戻った時グリッドが表示されないことがある」不具合があった。
    // 原因：ホーム初回表示直後、Xがタブ一覧(role="tablist")のDOM要素を
    // 短時間に何度か作り直すことがあり（スケルトン→本描画等）、その都度
    // 全体監視のbodyObserver経由でensureHomeTabObserver()が「新しいタブ
    // 一覧が見つかった」と判定し、まだ完了していない前のactivateGrid('home')
    // 呼び出しと重複してactivateGrid('home')を呼んでしまっていた。
    // 呼び出しが重複するたびにGrid.navTokenが増え、前の呼び出しは「もう
    // 古い」と判断してその場で処理を打ち切るため、短時間に何度も重複すると
    // どの呼び出しも完了できないまま終わり、Grid.activeがずっとfalseの
    // ままになる（トグルのラベルはON表示なのに実際はグリッド化されない、
    // という食い違いになる）。同じ目的（同じmode・同じURL）の呼び出しが
    // 既に進行中なら、ここで何もせず前の呼び出しに完了を任せる。
    if (!Grid.active && Grid.activatingMode === mode && Grid.activatingHref === location.href) return;
    const myHref = location.href;
    Grid.activatingMode = mode;
    Grid.activatingHref = myHref;
    // 旧グリッド解除〜新グリッド表示の間に素のページが一瞬見えるのを幕で
    // 隠す（実機報告：キャッシュ有り時だけでなく初回ロードでも見える、
    // を受けて常時張る方式に変更）。ただし初回読み込みは数秒かかることが
    // あるため、最大2.5秒で自動解除する保険を付ける（長い真っ黒画面の方が
    // 体験が悪い。速い通常ロードは幕の中で完結する）。除去はfinallyでも
    // 行うので、どの経路でreturnしても確実に消える。
    if (document.body && !Grid.veilEl) {
      const veil = document.createElement('div');
      veil.className = 'xmr-veil';
      veil.style.background = getComputedStyle(document.body).backgroundColor || '#000';
      document.body.appendChild(veil);
      Grid.veilEl = veil;
      setTimeout(() => {
        if (Grid.veilEl === veil) {
          veil.remove();
          Grid.veilEl = null;
        }
      }, 2500);
    }
    try {
      await activateGridInner(mode);
    } finally {
      if (Grid.veilEl) {
        Grid.veilEl.remove();
        Grid.veilEl = null;
      }
      // 実機で発生した重大バグの修正：この進行中フラグを、本体のあらゆる
      // return経路（body待ち失敗・トークン失効・先頭セル不発など）で解除し
      // 損ねると、同じURLでは以後二度とグリッドが起動しなくなるデッドロック
      // になる（bodyObserverが何度activateGridを呼んでも、この重複排除
      // ガードで全部弾かれてしまうため）。成功時(Grid.active=true)は本体側で
      // クリア済みなので触らない。より新しい呼び出しがフラグを自分の値で
      // 上書きしている場合も触らない。
      if (!Grid.active && Grid.activatingMode === mode && Grid.activatingHref === myHref) {
        Grid.activatingMode = null;
        Grid.activatingHref = null;
      }
    }
  }

  async function activateGridInner(mode) {
    if (Grid.active) deactivateGrid();
    const token = ++Grid.navToken;
    Grid.activeHref = location.href;

    // document_start直後はdocument.bodyがまだ存在しないことがある
    // （実機報告で再現：「画像のみ表示はONのはずなのに、開いた直後は
    // OFFの見た目で、手動でOFF→ONと切り替えて初めて表示される」）。
    // このactivateGrid()はasync関数なので、ここで例外が起きても呼び出し元
    // (onNavigate)には伝わらず、静かに失敗したPromiseになるだけで、以後
    // 誰も再試行しないまま終わる。ensureHomeToggle()に元々あったのと同じ
    // 「bodyが無ければ待つ」対策をここにも入れる。
    await waitFor(() => document.body, 5000, 50);
    if (!document.body || token !== Grid.navToken || currentGridMode() !== mode) return;

    // 実機報告：「Fキーで新しいタブに開いた後、そのタブを見ずにDiscordを
    // 見ていたらグリッドが空のままだった（リロードで直る）」。原因は
    // バックグラウンドタブへのブラウザのスロットリング：タイマーが大幅に
    // 間引かれ、Xの仮想リストもスクロールに反応しなくなるため、この後の
    // 初期化（先頭復帰待ち・pumpMore）が全部空回りする（HANDOFF「検証の壁」
    // と同じ現象）。対策：タブが前面に来るまで初期化自体を始めない。
    // 前面に来た瞬間から通常の初期化が走るので、ユーザーがタブを見た時には
    // ちょうど読み込みが始まる。
    // ※ポーリング(waitFor)はバックグラウンドタブではタイマー自体が
    //   間引かれて前面復帰後も反応が遅れるため、visibilitychangeイベントで
    //   即座に起きる方式にする。
    if (document.hidden) {
      await new Promise((resolve) => {
        const onVis = () => {
          if (!document.hidden) {
            document.removeEventListener('visibilitychange', onVis);
            resolve();
          }
        };
        document.addEventListener('visibilitychange', onVis);
      });
      if (token !== Grid.navToken || currentGridMode() !== mode) return;
    }

    // Xのスクロール位置復元待ちが最大20秒程度かかることがあるため
    // （下記コメント参照）、その間なにも表示されないまま固まって見えないよう
    // 簡易な読み込み表示を先に出しておく。グリッドの用意ができ次第
    // removeEarlyLoading()で消す。
    const earlyLoading = document.createElement('div');
    earlyLoading.className = 'xmr-early-loading';
    earlyLoading.textContent = t('loading');
    document.body.appendChild(earlyLoading);
    const removeEarlyLoading = () => earlyLoading.remove();

    const cellSelector = '[data-testid="primaryColumn"] [data-testid="cellInnerDiv"]';
    await waitFor(() => document.querySelector(cellSelector), 4000, 60);
    if (token !== Grid.navToken || currentGridMode() !== mode) {
      removeEarlyLoading();
      return;
    }

    // 実機で長時間・詳細に調査して判明した重大バグ：「Fキーで新しいタブに
    // 開いたプロフィールのメディア欄で、最初は1件だけ／まだ途中から表示
    // されている感じで、何度かタブを開き直してようやく直前まで見ていた
    // 画像が出てくる」という報告があった。実機で徹底調査し、確定的な
    // 原因を特定した。
    // (1) Xは同じアカウント・同じページへの再訪問時、以前のスクロール位置を
    //     内部的に記憶していて復元することがある（実機確認：新しいタブへの
    //     完全な初回ロードにもかかわらず window.scrollY が7000px超、最初の
    //     セルの translateY も5000px超という、明らかに「途中」の状態を
    //     実際に観測した）。
    // (2)【重要】window.scrollTo(0,0)を何度呼んでも、Xの仮想リストが
    //     実際に先頭のセルを再描画してくれないケースがあることを実機で
    //     確認した。scrollYはちゃんと0になるのに、最初のセルのtranslateY
    //     はズレたまま変わらない。本物のマウスホイール操作（Claude-in-Chromeの
    //     computerツールでの、ブラウザに対する実際の入力）でスクロールした
    //     時だけ直った。scrollTo()を複数回・位置を変えながら呼んでも
    //     （＝毎回確実にscrollイベント自体は発火させても）効果が無かった
    //     ことも確認済み。つまりこれは「JSからのscrollTo()では確実に
    //     再同期できない」というXの仮想リスト実装側の制約であり、
    //     content scriptからは（信頼できるユーザー入力イベントを生成
    //     できない、というブラウザのセキュリティ上の制約により）
    //     完全には回避できない。
    // 対策：しばらく自動でのscrollTo(0,0)リトライを試み、直らなければ
    // 確実に効くと実機確定済みのリロードを1回だけ行う(tryResyncReload)。
    // それでも直らない場合（リロード後のガード中）の最終手段として
    // 「マウスホイールを一度スクロールしてください」の案内を出す。
    // ※以前はここでchrome.debugger経由の擬似スクロールを試していたが、
    //   「message port closed」で時々失敗し効果も未確認だったため、
    //   debugger権限ごと廃止した（v3.45.0）。
    // 同タブSPA遷移から「戻ってきた」等でスナップショットがある場合は、
    // 先頭復帰もスクロールリセットも行わない（Xが復元した裏のリスト位置は
    // そのままにし、グリッドはキャッシュから即座に再構築する。以降の追加
    // 読み込みはその位置から続きを拾えばよい）。sourceRootの特定だけ行う。
    let cached = GridCache.get(location.href + '::' + (currentImageOnlyScope() || ''));
    let cacheFresh = !!(cached && cached.mode === mode && Date.now() - cached.savedAt < GRID_CACHE_TTL_MS);
    let firstCell = null;
    if (cacheFresh) {
      firstCell = await waitFor(() => document.querySelector(cellSelector), 4000, 60);
      if (token !== Grid.navToken || currentGridMode() !== mode) {
        removeEarlyLoading();
        return;
      }
      if (!firstCell) cacheFresh = false; // 裏リストが見つからなければ通常経路へ
    }
    if (!cacheFresh) {
    window.scrollTo(0, 0);
    for (let i = 0; i < 80; i++) {
      await sleep(300);
      if (token !== Grid.navToken || currentGridMode() !== mode) {
        removeEarlyLoading();
        return;
      }
      // 検索メディアタブのセルは<article>を持たない特殊構造（画像リンクの
      // 行）で、しかも実機で「先頭の1〜2セルが中身の無いスペーサーのまま」
      // というケースを確認したため、先頭固定ではなく「内容を持つ最初の
      // セル」を探す。他のモードは従来通り先頭セル+article判定。
      const candidate =
        mode === 'search'
          ? [...document.querySelectorAll(cellSelector)].find((c) => c.querySelector('a[href*="/photo/"]'))
          : document.querySelector(cellSelector);
      const hasContent = candidate && (mode === 'search' || candidate.querySelector('article'));
      if (!hasContent) {
        firstCell = null;
        continue; // まだ本文が無いスケルトン状態。先頭判定の対象にしない
      }
      firstCell = candidate;
      const m = (firstCell.style.transform || '').match(/translateY\(([-\d.]+)px\)/);
      const ty = m ? parseFloat(m[1]) : 0;
      // 「見た目上は先頭(ty<400)まで来ているのに中身が古い」ケースは
      // Fキー遷移では#xmr-freshの初回リロードがカバーする（v3.40.0）。
      // ここでのCDP擬似スクロールによる追い打ちは廃止した（v3.45.0、
      // debugger権限削除。効果未確認のうえ時々失敗していた）。
      if (ty < 400) {
        break; // 本文入りのセルが、実際に先頭付近まで戻ったと判断
      }
      window.scrollTo(0, 0); // まだ途中の位置なので念のため再度リセット（効かないこともある）
      // 約3秒scrollTo()を試しても直らない場合、確実に効くと実機確定済みの
      // リロードを1回だけ行う（ガードにより同一URLで5分に1回まで。リロード
      // 後にまた直らなくても二重リロードはせず、下のヒント表示に進む）。
      if (i === 10 && tryResyncReload()) {
        removeEarlyLoading();
        return;
      }
      // 以前はここで「マウスホイールを一度スクロールしてみてください」の
      // ヒントを出していたが、リロード方式の導入でほぼ到達しない上、
      // グリッドが空の状態ではホイールを回しても何も起きないケースがあり
      // ヒントとして不正確だったため削除した（実機フィードバック）。
    }
    } // end if(!cacheFresh)
    if (!firstCell) {
      removeEarlyLoading();
      return;
    }

    const sourceRoot = firstCell.parentElement;

    // Xのネイティブなタブ切替を隠す。/i/history のブックマーク/いいねタブは
    // ツールバーの検索・いいね・ブックマークと役割が重複するのでそのまま隠すが、
    // プロフィールのメディアタブ（ポスト/返信/リポスト/メディア等）は隠すと
    // 他のタブへ移動する手段が無くなってしまうため、隠す前にリンクを抽出して
    // ツールバーに載せ替える（実機報告：メディア欄から他のタブに移動できない）。
    const primaryForTablist = document.querySelector('[data-testid="primaryColumn"]');

    // プロフィールのメディア欄はバナー/自己紹介を全部隠すと「Xを見ている感じが
    // しない」という指摘があった。バナーごと復活させると再び巨大な空白の原因に
    // なるため、アバターとハンドル名(@xxx)だけ拾って小さなカードにする。
    // sticky/固定表示にはせず、後でグリッドの先頭要素として普通に流し込み、
    // スクロールすればXの通常のプロフィールページ同様に上へ流れて消えていくようにする。
    // 表示名・自己紹介文も拾えると「Xを見ている感じ」がもっと出るという
    // 指摘を受けて追加。data-testid="UserName"/"UserDescription" が
    // 使えればそちらを優先し（Xの比較的安定した目印）、無ければ従来の
    // 「@から始まるspanを探す」ヒューリスティックにフォールバックする。
    let profileCard = null;
    if (mode === 'media' && primaryForTablist) {
      const avatarImg = [...primaryForTablist.querySelectorAll('img')].find(
        (img) => img.src.includes('profile_images') && !sourceRoot.contains(img)
      );
      let handle = '';
      let name = '';
      const nameBlock = primaryForTablist.querySelector('[data-testid="UserName"]');
      if (nameBlock && !sourceRoot.contains(nameBlock)) {
        const handleSpan = [...nameBlock.querySelectorAll('span')].find((el) => /^@\w/.test(el.textContent.trim()));
        handle = handleSpan ? handleSpan.textContent.trim() : '';
        name = nameBlock.textContent.trim();
        if (handle) name = name.replace(handle, '').trim();
      } else {
        const handleEl = [...primaryForTablist.querySelectorAll('span')].find(
          (el) => /^@\w/.test(el.textContent.trim()) && !sourceRoot.contains(el)
        );
        handle = handleEl ? handleEl.textContent.trim() : '';
      }
      const bioBlock = primaryForTablist.querySelector('[data-testid="UserDescription"]');
      // 自己紹介文中のURL/ハッシュタグ/メンションは元々<a>タグだったが、
      // .textContent.trim()で構造ごと平文にしていたため、実機報告のように
      // リンクが完全なプレーンテキストになりクリックできなくなっていた。
      // childNodesを辿って<a>とプレーンテキストを区別し、後でクリックできる
      // <a>として組み立て直せる形（配列）で保持する。
      const bio = bioBlock && !sourceRoot.contains(bioBlock) ? extractBioParts(bioBlock) : [];
      // ウェブサイトリンク・登録日・フォロー数・「〇〇さんにフォローされています」も
      // 追加してほしいという要望を受けて拡張。ウェブサイト/登録日はdata-testidが
      // 安定して使える(UserUrl/UserJoinDate)。フォロー中/フォロワー数はhrefの
      // パターン(/username/following, /username/verified_followers)で判定。
      // 「フォローされています」の行だけはdata-testidが無いため、本文一覧の
      // 外側にある最小の要素をテキスト一致で探すヒューリスティックにした。
      const urlBlock = primaryForTablist.querySelector('[data-testid="UserUrl"]');
      // UserUrl自体が<a>そのものであることが多い（子に<a>が入れ子になっているとは限らない）。
      // 実機確認：querySelector('a')では自分自身にはマッチせず空になっていた。
      const urlA = urlBlock ? (urlBlock.tagName === 'A' ? urlBlock : urlBlock.querySelector('a')) : null;
      const url = urlBlock && !sourceRoot.contains(urlBlock) ? { text: urlBlock.textContent.trim(), href: urlA ? urlA.href : '' } : null;
      const joinDateBlock = primaryForTablist.querySelector('[data-testid="UserJoinDate"]');
      const joinDate = joinDateBlock && !sourceRoot.contains(joinDateBlock) ? joinDateBlock.textContent.trim() : '';
      const followingLink = [...primaryForTablist.querySelectorAll('a[href$="/following"]')].find(
        (a) => !sourceRoot.contains(a)
      );
      const followersLink = [
        ...primaryForTablist.querySelectorAll('a[href$="/verified_followers"], a[href$="/followers"]'),
      ].find((a) => !sourceRoot.contains(a));
      const following = followingLink
        ? { text: followingLink.textContent.trim(), href: followingLink.getAttribute('href') }
        : null;
      const followers = followersLink
        ? { text: followersLink.textContent.trim(), href: followersLink.getAttribute('href') }
        : null;
      const followedByEl = [...primaryForTablist.querySelectorAll('div')]
        .filter(
          (el) =>
            el.children.length <= 2 &&
            el.textContent &&
            // data-testidが無い行のためテキスト一致に頼らざるを得ない。
            // 主要言語だけORで対応（脆い暫定対応。マッチしない言語では
            // この行が静かに出ないだけで、他の機能には影響しない）。
            /フォローされています|Followed by/.test(el.textContent) &&
            !sourceRoot.contains(el)
        )
        .sort((a, b) => a.textContent.length - b.textContent.length)[0];
      const followedBy = followedByEl ? followedByEl.textContent.trim() : '';
      // フォローボタン：実機確認でdata-testidが"{ユーザーID}-follow"/"-unfollow"
      // という安定したパターンだったのでそれで検出する。本物のボタンは
      // (このあと)sourceRootより前の領域として.xmr-tablist-hideで非表示に
      // なるが、click()はdisplay:noneの要素にも普通に効く（合成clickはDOM
      // メソッド呼び出しであり、見た目の状態に依存しない）ため、それをそのまま
      // 流用する。Xの本物のReact管理下のボタンを移動させるのではなく、
      // 隠れたまま残して自前ボタンからclick()を委譲する方式なので、
      // 移動によるReactとの競合リスクが無い。
      const followBtn = [...primaryForTablist.querySelectorAll('[role="button"]')].find((el) => {
        const t = el.getAttribute('data-testid') || '';
        return (t.endsWith('-follow') || t.endsWith('-unfollow')) && !sourceRoot.contains(el);
      });
      // ヘッダー（バナー）画像。プロフィールページ上部のheader_photoリンク内の
      // imgから拾う（無いアカウントもいる）。
      const bannerImg = [...primaryForTablist.querySelectorAll('a[href$="/header_photo"] img')].find(
        (img) => !sourceRoot.contains(img)
      );
      if (avatarImg || handle || name) {
        profileCard = {
          bannerSrc: bannerImg ? bannerImg.src : '',
          avatarSrc: avatarImg ? avatarImg.src : '',
          handle,
          name,
          bio,
          url,
          joinDate,
          following,
          followers,
          followedBy,
          followBtn: followBtn || null,
        };
      }
    }

    const tablist = primaryForTablist && primaryForTablist.querySelector('[role="tablist"]');
    let extraTabs = [];
    let homeTabs = [];
    if (tablist && !tablist.contains(sourceRoot)) {
      extraTabs = [...tablist.querySelectorAll('a[role="tab"], [role="tab"] a')]
        .map((a) => ({ href: a.getAttribute('href'), text: a.textContent.trim() }))
        // ツールバー左端の自前「いいね」「ブックマーク」リンクと重複する
        // タブを除外する。以前は表示文言(/ブックマーク|いいね/)で判定して
        // いたため英語UI("Bookmarks"/"Likes")では重複ピルが出ていた。
        // 文言ではなくhrefで判定する（言語非依存）。
        .filter((t) => t.href && t.text && !/^\/i\/(bookmarks|history)/.test(t.href));
      // Xの「メディア」タブは実機確認で「画像」または「動画」のどちらか
      // 片方だけを動的に切り替えて表示する、単一の可変タブだった
      // （bareの/media=動画のみ、?filter=photo=画像のみ。常にどちらか
      // 一方しかタブに出ない）。実機報告「画像と動画を両方常にクリック
      // できるようにしてほしい」を受けて、このタブ枠だけ拾わず、
      // 「画像」「動画」の2つを自分で組み立てて差し替える。
      if (mode === 'media') {
        // Xの可変メディアタブの除外も文言("画像"/"動画")ではなくhrefで判定
        // （英語UIの"Photos"/"Videos"も正しく除外されるように）。
        extraTabs = extraTabs.filter((t) => !/^\/[^/]+\/media\/?(\?.*)?$/.test(t.href));
        const um = location.pathname.match(/^\/([^/]+)\/media\/?$/);
        const user = um ? um[1] : '';
        if (user) {
          extraTabs.push({ href: '/' + user + '/media?filter=photo', text: t('pillPhotos') });
          // isVideoPill: bare /media（動画側）へ遷移する自前ピルの印。
          // クリック時の?filter=photoリダイレクト抑止の判定に、表示文言
          // ではなくこのフラグを使う（i18n化しても壊れないように）。
          extraTabs.push({ href: '/' + user + '/media', text: t('pillVideos'), isVideoPill: true });
        }
      }
      // ホームの「おすすめ／フォロー中／自分で作ったリスト」タブはURLを持たない
      // （実機確認：クリックしてもURLが変わらずaria-selectedだけが付け替わる）
      // ので、profileのextraTabsのようにhrefではリンクできない。実DOM要素への
      // 参照を保持しておき、自前ボタンのクリックでそちらへclick()を委譲する
      // （フォローボタンと同じ「隠れたまま残す」方式）。
      if (mode === 'home') {
        homeTabs = [...tablist.querySelectorAll('[role="tab"]')].map((el) => ({
          el,
          text: el.textContent.trim(),
          selected: el.getAttribute('aria-selected') === 'true',
        }));
      }
      tablist.classList.add('xmr-tablist-hide');
    }
    // 「戻る + タイトル」の細いヘッダーバーも含め、本文一覧より前にある要素は
    // ツールバー（検索・いいね・ブックマーク）と役割が重複するのでまとめて隠す。
    // ページによって有無も内容も違うので個別に狙わず、sourceRootの祖先を辿って
    // 「本文より前にある兄弟要素」を汎用的に全部隠し、その分グリッドを上に詰める。
    if (primaryForTablist) {
      let node = sourceRoot;
      while (node && node !== primaryForTablist) {
        const parent = node.parentElement;
        if (!parent) break;
        for (const sib of Array.from(parent.children)) {
          if (sib === node) break;
          sib.classList.add('xmr-tablist-hide');
        }
        node = parent;
      }
    }

    // 画面上のどこにグリッドを置くか、Xのレイアウト計算に頼らず自分で実測して決める
    // （primaryColumnの幅を広げようとする方式は、Xの内部ラッパーとの噛み合わせが
    //  ズーム倍率や列数変更のたびに壊れやすかったため撤回。position:fixedで
    //  ナビの右端からビューポート右端まで独立して覆う方式にした。app.htmlが
    //  Xのレイアウトと一切干渉しないから壊れないのと同じ考え方）。
    const navElForRect = document.querySelector('header[role="banner"]');
    const navRight = navElForRect ? Math.ceil(navElForRect.getBoundingClientRect().right) : 0;
    // プロフィールのメディアタブ等では、実測値が異常に大きくなり巨大な空白ができる
    // 不具合が実際に起きた（原因未特定）。Xの画面内ヘッダーは通常120px以内に収まる
    // ため、上限でクランプして安全側に倒す。
    const topOffset = Math.min(120, Math.max(0, Math.round(sourceRoot.getBoundingClientRect().top)));

    sourceRoot.classList.add('xmr-source-hidden');
    removeEarlyLoading();

    const shell = document.createElement('div');
    shell.className = 'xmr-shell';
    shell.style.left = navRight + 'px';
    shell.style.top = topOffset + 'px';
    const bg = getComputedStyle(document.body).backgroundColor;
    if (bg) shell.style.background = bg;
    // hideSidebar設定がONならサイドバーを丸ごと隠して空いた横幅をグリッドに
    // 使う。OFFならサイドバーは一切手を加えず（検索ボックスだけを残す等の
    // 部分的な処理はしない）、Xが普段通り表示するサイドバー全部をそのまま
    // 見せる。代わりにshellの右端をサイドバーの左端で止めて覆わないように
    // する（computeShellRight()）。
    const sidebarForHide = document.querySelector('[data-testid="sidebarColumn"]');
    if (sidebarForHide) {
      if (Settings.hideSidebar) sidebarForHide.classList.add('xmr-sidebar-hide');
      else sidebarForHide.classList.remove('xmr-sidebar-hide');
      // 実機報告：検索ボックスが小さい、もう少し横に長くしてほしい。
      // DOM上の位置は動かさずCSSで見た目の幅だけ広げる（実機確認済みの
      // 「DOM移動は危険だがCSSでの見た目の調整は安全」という教訓と同じ）。
      const searchWidgetForWiden = findSearchWidgetEl(sidebarForHide);
      if (searchWidgetForWiden) searchWidgetForWiden.classList.add('xmr-search-widen');
    }
    shell.style.right = computeShellRight() + 'px';

    const toolbar = document.createElement('div');
    toolbar.className = 'xmr-toolbar';
    // x.com/i/lists は実際には中身が空の壊れたページだったため撤去。
    // 「リスト」というのは、リスト管理ページを開きたいのではなく、ホームの
    // タブ（おすすめ／フォロー中／自分で作ったリスト）をここから切り替えたい、
    // という意味だったと判明。下のhomeTabsの方で対応する。
    // 「ツールバーが渋滞気味で雑多」との報告を受けて、ボタンを役割ごとの
    // グループ(.xmr-tb-group)に分けた。各グループは薄い背景色の囲みで
    // 視覚的に区別する（ボタン自体のクラス名・イベント処理は従来のまま。
    // 他の場所からGrid.shellEl.querySelector('.xmr-tb-filter-unread')等の
    // サブツリー検索で参照されているため、包んでも壊れない）。
    //  ①nav: 別ページへの導線（いいね/ブックマーク）
    //  ②filter: このグリッドの表示操作（更新/未読のみ/動画のみ/画像のみ表示）
    //  ③config: 列数/設定/検索（margin-left:autoで右端寄せ。検索が右上に
    //    来るのはXの本来の検索位置に合わせた実機フィードバック）
    // タブ類（ホームのおすすめ/フォロー中/リスト、アカウントのポスト/返信等）は
    // v3.56.0でツールバーから独立した「タブバー」(.xmr-tabbar、X本来の
    // 下線タブ風)へ移動した（実機フィードバック：Xと見た目が違いすぎて
    // 初見で使いづらい。できるだけ本家のUIに近づける方針）。
    // 文言はt()（自前のmessages.json）由来のみで、Xのページ等の外部文字列は
    // 混ぜないこと（innerHTML組み立てのため）。
    toolbar.innerHTML =
      '<div class="xmr-tb-group xmr-tb-group-nav">' +
      '<a href="https://x.com/i/history/likes">' + t('toolbarLikes') + '</a>' +
      '<a href="https://x.com/i/bookmarks">' + t('toolbarBookmarks') + '</a>' +
      '</div>' +
      '<div class="xmr-tb-group xmr-tb-group-filter">' +
      '<button type="button" class="xmr-tb-refresh">' + t('toolbarRefresh') + '</button>' +
      '<span class="xmr-tb-refresh-status"></span>' +
      '<button type="button" class="xmr-tb-filter-unread">' + t('filterUnread') + ': OFF</button>' +
      '<button type="button" class="xmr-tb-filter-video">' + t('filterVideoOnly') + ': OFF</button>' +
      '</div>' +
      '<div class="xmr-tb-group xmr-tb-group-config">' +
      '<label class="xmr-tb-cols">' + t('toolbarCols') + ' <input type="number" class="xmr-cols-input" min="1" max="10" step="1"></label>' +
      '<button type="button" class="xmr-tb-settings" title="' + t('toolbarSettingsTitle') + '">⚙ ' + t('toolbarSettings') + '</button>' +
      '</div>';
    // 右サイドバーの常時ON/OFFはoptions.htmlの設定チェックボックスで行う
    // （ツールバーに専用の常時トグルボタンを置いたこともあったが、実機
    // 報告を受けて「検索の時だけ一時的に出す」ボタン(xmr-tb-search-peek。
    // 下のopenSidebarPeek参照)に置き換えた。常時の切り替え自体は設定
    // ページに残す）。
    // 「既読は隠す」「動画だけ見る」トグル。実機報告を受けて追加。対象外の
    // タイルはdisplay:noneで隙間なく詰める。WASDは配列インデックス計算を
    // 使わず、選択中タイルの実測位置から次の表示中タイルを探す方式
    // （spatialNeighbor()）に切り替わるため、詰めても列がズレない。
    toolbar.querySelector('.xmr-tb-filter-unread').addEventListener('click', () => {
      Grid.filterUnread = !Grid.filterUnread;
      writeFilterSetting('xmr-filter-unread', Grid.filterUnread); // 場所ごとに永続化
      Grid.gridEl.classList.toggle('xmr-filter-unread', Grid.filterUnread);
      refreshFilterToggleLabels();
      ensureSelectionVisible();
    });
    // メディア欄(mode==='media')は?filter=photoで画像だけに絞っているため
    // 動画のタイル自体がそもそも存在しない（動画は「動画」ピルで別URLへ
    // 移動する方式にした）。「動画のみ表示」を出しても押すたびに空っぽの
    // グリッドになるだけで意味が無いため、メディア欄だけこのボタンを出さない。
    if (mode === 'media') {
      toolbar.querySelector('.xmr-tb-filter-video').remove();
    } else {
      toolbar.querySelector('.xmr-tb-filter-video').addEventListener('click', () => {
        Grid.filterVideoOnly = !Grid.filterVideoOnly;
        writeFilterSetting('xmr-filter-video', Grid.filterVideoOnly); // 場所ごとに永続化
        Grid.gridEl.classList.toggle('xmr-filter-video', Grid.filterVideoOnly);
        refreshFilterToggleLabels();
        ensureSelectionVisible();
      });
    }
    // 設定ページ(options.html)はbrave://extensionsの詳細からしか開けず
    // 分かりにくいという指摘があったため、ここから直接開けるようにした。
    // openOptionsPage()はcontent scriptから直接呼べないのでbackground.js
    // にメッセージで依頼する。
    toolbar.querySelector('.xmr-tb-settings').addEventListener('click', () => {
      try {
        chrome.runtime.sendMessage({ type: 'xmr-open-options' });
      } catch (e) {
        // 拡張機能コンテキストが失われている等は無視
      }
    });
    // ナビ群の「いいね」「ブックマーク」リンクも同タブSPA遷移にする
    // （<a href>のままだとXの丸ごと再ロードが走って遅い）。hrefは残すので
    // 中クリック/Ctrl+クリックでの新タブは従来通り可能。
    toolbar.querySelectorAll('.xmr-tb-group-nav a').forEach((navA) => {
      navA.addEventListener('click', (e) => {
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) return;
        e.preventDefault();
        try {
          xmrSpaNavigate(new URL(navA.href).pathname);
        } catch (err) {}
      });
    });
    // 【v3.56.0】タブ類はツールバーから独立した「タブバー」へ（DOM APIで
    // 組み立ててHTML injectionを避けるのは従来通り）。X本来の見た目
    // （下線付きタブ）に寄せる：ホームのおすすめ/フォロー中/リストは
    // グリッドの上に、アカウントのポスト/返信/リポスト/画像/動画は
    // プロフィールカードの下に、それぞれ本家と同じ位置関係で置く。
    // 「このアカウント:」ラベルは本家に無いので廃止。
    let tabbarEl = null;
    const mkXTab = (text, active) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'xmr-xtab' + (active ? ' xmr-xtab-active' : '');
      const span = document.createElement('span');
      span.className = 'xmr-xtab-label';
      span.textContent = text;
      b.appendChild(span);
      return b;
    };
    if (extraTabs.length > 0) {
      tabbarEl = document.createElement('div');
      tabbarEl.className = 'xmr-tabbar';
      extraTabs.forEach((tb) => {
        // アクティブ判定：画像ピル=?filter=photo付き、動画ピル=クエリ無し、
        // その他はパス一致（hrefベース＝言語非依存）
        const active = tb.isVideoPill
          ? location.search.indexOf('filter=photo') === -1 && /\/media\/?$/.test(location.pathname)
          : tb.href.indexOf('?') !== -1
            ? location.pathname + location.search === tb.href
            : location.pathname === tb.href;
        const btn = mkXTab(tb.text, active);
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          if (mode === 'media' && tb.isVideoPill) {
            // 「動画」（bareの/media）はautoRedirectMediaPhoto()に引き戻され
            // ないよう1回だけリダイレクトを抑制してからSPA遷移する
            suppressNextPhotoRedirect = true;
          }
          xmrSpaNavigate(tb.href);
        });
        tabbarEl.appendChild(btn);
      });
    }
    // ホームのタブ切替。押すと本物のタブ要素へclick()を委譲するだけなので、
    // 「おすすめ」以外を押すとensureHomeTabObserver()が検知して自動で
    // グリッドを解除し、本物のタイムライン表示に切り替わる。
    if (homeTabs.length > 0) {
      tabbarEl = document.createElement('div');
      tabbarEl.className = 'xmr-tabbar';
      homeTabs.forEach((tb, i) => {
        const btn = mkXTab(tb.text, tb.selected);
        btn.dataset.xmrHomeIdx = String(i);
        btn.addEventListener('click', () => tb.el.click());
        tabbarEl.appendChild(btn);
      });
    }
    // 右サイドバーを常時隠す設定(hideSidebar)にしている人でも、検索したい
    // 時だけ一時的にサイドバーを出して検索ボックスへ自動フォーカスする
    // ボタン。実機報告を受けて追加：常時ON/OFFの大元の切り替えは設定ページ
    // に残しつつ、隠している間だけ「検索の時だけ出す」導線を用意する。
    // サイドバーを隠していない(Settings.hideSidebar===false)時は元から
    // 検索ボックスが常に見えているので、このボタン自体を出さない。
    if (Settings.hideSidebar) {
      const searchPeekBtn = document.createElement('button');
      searchPeekBtn.type = 'button';
      searchPeekBtn.className = 'xmr-tb-search-peek';
      searchPeekBtn.innerHTML = '<span class="xmr-tb-search-icon">⌕</span>' + t('toolbarSearch');
      searchPeekBtn.addEventListener('click', () => openSidebarPeek());
      // 実機フィードバック：Xの本来のUIでは検索は右上にあるので、位置の
      // 直感を合わせて一番右（設定グループの末尾）に置く。押すと右側の
      // サイドバーが一時的に出てくる仕組みとも位置が繋がって自然。
      toolbar.querySelector('.xmr-tb-group-config').appendChild(searchPeekBtn);
    }
    const colsInput = toolbar.querySelector('.xmr-cols-input');
    colsInput.value = CONFIG.gridCols;
    // Xの「N件のポストを表示」通知バナーはこのグリッドの裏に隠れて押せなくなる。
    // 単純なページリロードだと、Xがサーバーから返す初期タイムラインが
    // 「N件の新着」バナーが指す最新状態より古いことがあり、「更新しても
    // 変わらない」という不具合報告があった。ホームでは実際に新着を取り込む
    // 操作（新着バナー、無ければホームアイコンの「既にホームにいる状態で
    // もう一度押すと最新に更新される」挙動）を裏で行ってからグリッドを
    // 作り直す。それ以外（メディア/いいね/ブックマーク）は単純リロードで十分。
    toolbar.querySelector('.xmr-tb-refresh').addEventListener('click', () => {
      if (Grid.mode === 'home') {
        refreshHomeTimeline();
      } else {
        markAllLoadedAsSeen(); // 更新＝ここで一区切り
        location.reload();
      }
    });

    const grid = document.createElement('div');
    grid.className = 'xmr-cgrid';
    grid.style.setProperty('--xmr-cols', CONFIG.gridCols);

    colsInput.addEventListener('input', () => {
      const n = Math.max(1, Math.min(10, parseInt(colsInput.value, 10) || 1));
      CONFIG.gridCols = n;
      try {
        localStorage.setItem('xmr-grid-cols', String(n)); // 次回以降も同じ列数で
      } catch (e) {}
      grid.style.setProperty('--xmr-cols', n);
    });

    const loading = document.createElement('div');
    loading.className = 'xmr-loading';
    loading.textContent = t('loading');
    loading.style.display = 'none';
    shell.appendChild(toolbar);
    if (profileCard) {
      const card = document.createElement('div');
      card.className = 'xmr-profile-card';
      // ヘッダー（バナー）画像があればカードの最上部に横幅いっぱいで表示する
      // （カード本体はflex行のままにし、バナーはflex-basis:100%で1行を占有）
      if (profileCard.bannerSrc) {
        const bannerEl = document.createElement('img');
        bannerEl.className = 'xmr-profile-card-banner';
        bannerEl.src = profileCard.bannerSrc;
        card.appendChild(bannerEl);
      }
      if (profileCard.avatarSrc) {
        const avatar = document.createElement('img');
        avatar.src = profileCard.avatarSrc;
        avatar.style.cursor = 'pointer';
        // アイコンを押したらそのアカウントのメインメニュー(ポスト)へ。
        // 今いるURL自体がそのアカウントの/mediaなので、そこからusernameを取る。
        const username = location.pathname.split('/')[1];
        if (username) {
          avatar.addEventListener('click', (e) => {
            e.stopPropagation();
            xmrSpaNavigate('/' + username); // 同タブSPA遷移（速い・戻りで復元）
          });
        }
        card.appendChild(avatar);
      }
      const textWrap = document.createElement('div');
      textWrap.className = 'xmr-profile-card-text';
      if (profileCard.name) {
        const name = document.createElement('div');
        name.className = 'xmr-profile-card-name';
        name.textContent = profileCard.name;
        textWrap.appendChild(name);
      }
      if (profileCard.handle) {
        const handle = document.createElement('span');
        handle.textContent = profileCard.handle;
        textWrap.appendChild(handle);
      }
      if (profileCard.bio && profileCard.bio.length > 0) {
        const bio = document.createElement('div');
        bio.className = 'xmr-profile-card-bio';
        profileCard.bio.forEach((part) => {
          if (part.href) {
            const a = document.createElement('a');
            a.className = 'xmr-profile-card-bio-link';
            a.href = part.href;
            a.textContent = part.text;
            a.target = '_blank';
            a.rel = 'noopener';
            bio.appendChild(a);
          } else {
            bio.appendChild(document.createTextNode(part.text));
          }
        });
        textWrap.appendChild(bio);
      }
      if (profileCard.url || profileCard.joinDate) {
        const meta = document.createElement('div');
        meta.className = 'xmr-profile-card-meta';
        if (profileCard.url && profileCard.url.href) {
          const a = document.createElement('a');
          a.href = profileCard.url.href;
          a.target = '_blank';
          a.rel = 'noopener';
          a.textContent = profileCard.url.text;
          meta.appendChild(a);
        }
        if (profileCard.joinDate) {
          const span = document.createElement('span');
          span.textContent = profileCard.joinDate;
          meta.appendChild(span);
        }
        textWrap.appendChild(meta);
      }
      if (profileCard.following || profileCard.followers) {
        const stats = document.createElement('div');
        stats.className = 'xmr-profile-card-stats';
        [profileCard.following, profileCard.followers].forEach((f) => {
          if (!f) return;
          const a = document.createElement('a');
          a.href = 'https://x.com' + f.href;
          a.target = '_blank';
          a.rel = 'noopener';
          a.textContent = f.text;
          stats.appendChild(a);
        });
        textWrap.appendChild(stats);
      }
      if (profileCard.followedBy) {
        const fb = document.createElement('div');
        fb.className = 'xmr-profile-card-followedby';
        fb.textContent = profileCard.followedBy;
        textWrap.appendChild(fb);
      }
      card.appendChild(textWrap);
      if (profileCard.followBtn) {
        const followBtnEl = profileCard.followBtn;
        const followUi = document.createElement('button');
        followUi.type = 'button';
        followUi.className = 'xmr-profile-card-follow';
        const syncFollowLabel = () => {
          // クリック後にReactが要素を差し替える可能性があるため、毎回
          // primaryColumnから現在のフォローボタンを引き直す（初期参照が
          // 切り離されていても正しく追従する）。
          const liveBtn =
            document.querySelector('[data-testid="primaryColumn"] [data-testid$="-unfollow"]') ||
            document.querySelector('[data-testid="primaryColumn"] [data-testid$="-follow"]') ||
            followBtnEl;
          const label = liveBtn.textContent.trim();
          if (label) followUi.textContent = label; // 表示文言はXのものをそのままコピー（言語非依存）
          // フォロー中かどうかは文言比較ではなくtestidで判定する。以前は
          // label !== 'フォロー' で判定していたため、英語UI（"Follow"）では
          // 未フォローでも常に「フォロー中」の見た目になっていた。
          const t = liveBtn.getAttribute('data-testid') || '';
          followUi.classList.toggle('xmr-profile-card-follow-active', t.endsWith('-unfollow'));
        };
        syncFollowLabel();
        followUi.addEventListener('click', () => {
          const liveBtn =
            document.querySelector('[data-testid="primaryColumn"] [data-testid$="-unfollow"]') ||
            document.querySelector('[data-testid="primaryColumn"] [data-testid$="-follow"]') ||
            followBtnEl;
          liveBtn.click();
          // 本物のボタンのラベルが変わるまで一瞬かかるので、少し待ってから反映
          setTimeout(syncFollowLabel, 400);
        });
        card.appendChild(followUi);
      }
      shell.appendChild(card);
    }
    // タブバーはX本来と同じ位置関係：プロフィールカードの下（ホームでは
    // ツールバーのすぐ下）・グリッドの上。stickyでツールバーの直下に貼り付く
    // （topはツールバーの実測高さ。1行に収まらず折り返した場合も追従）。
    if (tabbarEl) shell.appendChild(tabbarEl);
    shell.appendChild(grid);
    shell.appendChild(loading);
    // position:fixedなのでDOM上の挿入位置は無関係。primaryColumnの内部構造から
    // 完全に切り離すためbodyに直接追加する（Xのレイアウトと干渉させないため）。
    document.body.appendChild(shell);
    const syncTabbarTop = () => {
      if (tabbarEl) tabbarEl.style.top = toolbar.offsetHeight + 'px';
      if (Grid.newPostsBtn) {
        const sr = shell.getBoundingClientRect();
        // タブバーに重ねる高さ（実機フィードバック：画像に被らないようもう少し上へ）
        Grid.newPostsBtn.style.top = sr.top + toolbar.offsetHeight + 4 + 'px';
        Grid.newPostsBtn.style.left = sr.left + sr.width / 2 + 'px';
      }
    };
    syncTabbarTop();

    // ホーム限定：Xの新着ピル（「◯◯さんがポストしました」）が裏に出たら、
    // グリッド上にも同等のバナーを出す（実機フィードバック：ONの時も新着が
    // 届いた表示が欲しい＋クリックでその分を読み込みたい）。検出は
    // pillLabel(実機観測で確定したtestid)ベースで言語非依存。クリックで
    // 本物のピルをclickし、更新処理(refreshHomeTimeline)で取り込む。
    if (mode === 'home') {
      const npBtn = document.createElement('button');
      npBtn.type = 'button';
      npBtn.className = 'xmr-newposts';
      npBtn.textContent = '↑ ' + t('bannerNewPosts');
      npBtn.style.display = 'none';
      npBtn.addEventListener('click', () => {
        npBtn.style.display = 'none';
        refreshHomeTimeline();
      });
      shell.appendChild(npBtn);
      Grid.newPostsBtn = npBtn;
      Grid.newPostsTimer = setInterval(() => {
        if (!Grid.active || Grid.mode !== 'home') return;
        const pill = findNewPostsPillButton(document.querySelector('[data-testid="primaryColumn"]'));
        // 本物ピルの「穴あき表示」：ピルは合成クリックに反応しない（trusted
        // 要求。実機確定）ため、代理クリックではなく本物をグリッドの上に
        // 露出させ、ユーザー自身のトラステッドクリックをそのまま届かせる。
        // ピルを内包する隠し要素をhard(display:none)→soft(visibility:hidden+
        // 子孫のピルだけvisible)に差し替える。ピルが消えたら元に戻す。
        // 実機フィードバック：戻ってきた直後はキャッシュ復元のため、Xが
        // ピルを出さずに新着を抱えているケース（ホームアイコンに青ドット
        // だけ付く）がある。ドットのDOM上の存在（ナビリンク内のsvgの後ろの
        // div。実機観測で確定した構造）もトリガーに含める。設定でドットを
        // 非表示にしていてもdisplay:noneなだけで要素は存在するので検知できる。
        const homeLink = document.querySelector('[data-testid="AppTabBar_Home_Link"]');
        const homeDot = homeLink && homeLink.querySelector('svg ~ div');
        // 更新直後のスヌーズ中は、ドットもピルも無視して黙る（上の
        // refreshHomeTimeline()末尾のコメント参照）。
        const snoozed = Date.now() < (Grid.bannerSnoozeUntil || 0);
        const show = (!!pill || !!homeDot) && !snoozed && !Grid.refreshing && Settings.newPostsBanner;
        if ((npBtn.style.display === 'none') === show) {
          npBtn.style.display = show ? 'block' : 'none';
          if (show) syncTabbarTop();
        }
      }, 4000);
    }

    Grid.shellResizeHandler = () => {
      const navR = navElForRect ? Math.ceil(navElForRect.getBoundingClientRect().right) : 0;
      shell.style.left = navR + 'px';
      shell.style.right = computeShellRight() + 'px';
      syncTabbarTop();
    };
    window.addEventListener('resize', Grid.shellResizeHandler);

    Grid.mode = mode;
    Grid.sourceRoot = sourceRoot;
    Grid.seen = new Set();
    Grid.pending = new Map();
    Grid.entries = [];
    Grid.shellEl = shell;
    Grid.gridEl = grid;
    Grid.loadingEl = loading;
    Grid.refreshStatusEl = toolbar.querySelector('.xmr-tb-refresh-status');
    Grid.level = 'grid';
    Grid.selIndex = 0;
    Grid.maxSeenIndex = -1;
    Grid.active = true;
    Grid.activatingMode = null;
    Grid.activatingHref = null;
    Grid.homeScope = currentImageOnlyScope() || '';

    // 保存済みのフィルタ状態を復元する（場所ごとに個別記憶。詳細は
    // readFilterSetting()のコメント参照）。
    // 動画のみ表示はメディア欄ではボタン自体が無いので復元しない。
    Grid.filterUnread = readFilterSetting('xmr-filter-unread');
    Grid.filterVideoOnly = mode !== 'media' && readFilterSetting('xmr-filter-video');
    if (Grid.filterUnread) Grid.gridEl.classList.add('xmr-filter-unread');
    if (Grid.filterVideoOnly) Grid.gridEl.classList.add('xmr-filter-video');
    refreshFilterToggleLabels();

    if (cacheFresh) {
      // 【キャッシュ復元経路】読み込み直しゼロ：スナップショットのエントリ
      // 配列からタイルを再構築し、選択位置とスクロール位置をそのまま戻す。
      // settleGridOrder()は行わない（既に整った並びのスナップショット）。
      Grid.entries = cached.entries;
      Grid.seen = new Set(cached.seen);
      for (const en of Grid.entries) {
        Grid.gridEl.appendChild(makeTile(en));
      }
      Grid.selIndex = Math.min(cached.selIndex, Grid.entries.length - 1);
      Grid.maxSeenIndex = cached.maxSeenIndex;
      Grid.userHasNavigated = true; // 完了時の並べ直しを確実にスキップ
      paintSelection(true);
      Grid.shellEl.scrollTop = cached.scrollTop;
    } else {
      harvestNew();
      paintSelection();
    }

    // 高頻度に発火するmutationをrAFでまとめて、スクロール中のガクつきを抑える
    let harvestScheduled = false;
    const scheduleHarvest = () => {
      if (harvestScheduled) return;
      harvestScheduled = true;
      requestAnimationFrame(() => {
        harvestScheduled = false;
        harvestNew();
      });
    };
    Grid.sourceObserver = new MutationObserver(scheduleHarvest);
    Grid.sourceObserver.observe(sourceRoot, { childList: true, subtree: true });

    // 保留中（画像がまだ描画されていない）セルを再チェックするための定期タイマー
    Grid.pendingTimer = setInterval(() => {
      if (Grid.pending && Grid.pending.size > 0) harvestNew();
    }, 500);

    let scrollSelSyncScheduled = false;
    shell.addEventListener('scroll', () => {
      // 先読み開始が下端800pxから（タイル約1.5行分）では、ユーザーが底に
      // 到達してからpumpMoreが始まることが多く「ロードを待たされている」
      // 体感の一因だった。2画面分手前から先読みを始める。
      const nearBottom = shell.scrollTop + shell.clientHeight > shell.scrollHeight - shell.clientHeight * 2;
      if (nearBottom) pumpMore(Grid.entries.length + CONFIG.pumpBatchCount);
      // 選択位置の追従は毎フレーム重い処理をしないよう、rAFで1フレームに
      // 1回までに間引く。
      if (!scrollSelSyncScheduled) {
        scrollSelSyncScheduled = true;
        requestAnimationFrame(() => {
          scrollSelSyncScheduled = false;
          updateSelectionFromScroll();
        });
      }
    });

    // 初回の一括読み込みが終わったこのタイミングでだけ並び順を1回整える
    // （ユーザーがまだ意図的な操作を始めていない前提なので、ここでタイル
    // 位置が動いても実害が無い）。以降の追加読み込み(pumpMore/harvestNew)は
    // 末尾へ追加するだけで、既に見えているタイルの位置を動かさない。
    // 判定にはmaxSeenIndex(>0)ではなくuserHasNavigatedを使う。理由は
    // activateGrid()側の同種の分岐と同じ：maxSeenIndexはマウススクロール
    // 追従(updateSelectionFromScroll)だけでも上がってしまい、意図的な
    // WASD/A/D/Spaceでの操作と区別できないため（詳細はactivateGrid()内の
    // コメント参照）。
    if (!cacheFresh) {
      pumpMore(CONFIG.initialFillCount).then(() => {
        if (Grid.userHasNavigated) return;
        settleGridOrder();
        Grid.selIndex = 0;
        paintSelection();
      });
    }
  }

  // ============================================================
  // ルーティング
  // ============================================================
  // ツールバーの検索ボタンで/exploreへ来た時、本物の検索入力欄に自動で
  // フォーカスする（最近の検索・候補が即座に出るようにするため）。
  // クリックではなくURLで直接来た場合も無害なので常に試す。
  async function focusNativeSearchIfOnExplore() {
    if (location.pathname !== '/explore') return;
    const input = await waitFor(() => document.querySelector('[data-testid="SearchBox_Search_Input"]'), 3000, 100);
    if (input) input.focus();
  }

  // Xの表示テーマ（白/ダークブルー/黒）をbodyの背景輝度で判定し、白系なら
  // html.xmr-lightを付ける（content.css側のライトテーマ上書きが効く）。
  // テーマ名の文言には依存しない（言語非依存）。
  function applyXTheme() {
    const el = document.body || document.documentElement;
    if (!el) return;
    const bg = getComputedStyle(el).backgroundColor || '';
    const m = bg.match(/(\d+),\s*(\d+),\s*(\d+)/);
    let light = false;
    if (m) {
      const lum = 0.299 * +m[1] + 0.587 * +m[2] + 0.114 * +m[3];
      light = lum > 128;
    }
    // classList.toggleは同値ならattribute変更を発生させない（原則3の観点で安全）
    document.documentElement.classList.toggle('xmr-light', light);
  }

  function onNavigate() {
    // /compose/…（リプライ・新規ポストの入力モーダル）はモーダル用の仮想URL
    // で、下のページ（グリッド含む）はそのまま生きている。ここで通常の遷移
    // 処理をするとグリッドが解除→再構築されて選択位置が失われるため、
    // モーダルルートでは何もしない（閉じれば元のURLに戻り、その時も
    // 「同じURLに戻っただけ」なので余計な再構築は起きない）。
    if (/^\/compose\//.test(location.pathname)) return;
    nativeSetSelection(null); // ページ遷移のたびに古い選択枠を消す（DOM再利用による残留防止）
    applyXTheme();
    autoRedirectMediaPhoto();
    widenMain();
    ensureImageOnlyToggle();
    ensureHomeTabObserver();
    focusNativeSearchIfOnExplore();
    const mode = currentGridMode();
    if (mode) {
      activateGrid(mode);
    } else {
      deactivateGrid();
      autoFocusStatusPage();
    }
  }

  onUrlChange(onNavigate);

  // 自前のトグルボタン等はSPA内の部分再描画で消えることがあるので継続監視
  const bodyObserver = new MutationObserver(() => {
    widenMain();
    ensureImageOnlyToggle();
    ensureHomeTabObserver();
    applyXTheme(); // 設定でテーマを切り替えた場合もページ遷移なしで追従させる
  });
  waitFor(() => document.body, 5000, 50).then((body) => {
    if (body) bodyObserver.observe(body, { childList: true, subtree: true });
  });
})();

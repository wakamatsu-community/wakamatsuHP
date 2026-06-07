# 若松町町内会ポータルサイト

ホームページは**表示専用ポータル**として動作します。  
管理者は Google Drive / Calendar / Forms / Sheets / My Maps のみを操作します。ホームページのコードを直接編集する必要はありません。

---

## ファイル構成

```
/
├ index.html          トップページ（ポータル入口）
├ events.html         行事予定（Google Calendar埋込）
├ equipment.html      備品予約（Google Forms）
├ map.html            地域マップ（Google My Maps）
├ disaster.html       防災情報
├ documents.html      回覧板・資料室（Google Drive連携）
├ gallery.html        写真アルバム（Google Drive連携）
├ admin.html          管理画面（将来拡張用）
├ style.css           共通スタイル
├ script.js           後方互換スクリプト
├ js/
│  ├ config.js        ← URLの一元管理（ここだけ編集）
│  ├ main.js          エントリーポイント
│  ├ calendar.js      カレンダー埋込
│  ├ drive.js         Driveドキュメント表示
│  ├ map.js           マップ埋込
│  ├ form.js          フォーム連携
│  ├ trash.js         ゴミ収集案内（Sheets連携）
│  └ gallery.js       写真アルバム
├ assets/             静的アセット
├ images/             画像ファイル
└ docs/               ローカルドキュメント
```

---

## ローカル起動方法

Live Server（VS Code 拡張）を使う場合は `index.html` を右クリック →「Open with Live Server」。  
Python の場合:

```bash
python -m http.server 8000
```

→ ブラウザで `http://localhost:8000/` を開く。

---

## GitHub Pages 公開方法

1. リポジトリへ push
2. GitHub Settings > Pages > Source: **Deploy from a branch**
3. Branch: **main / (root)** に設定して保存
4. 数分後に発行された URL でアクセス可能

---

## URL の設定変更（js/config.js）

Google サービスの URL はすべて `js/config.js` で一元管理します。  
以下のキーを実際の値に書き換えるだけで連携が完了します。

| キー | 用途 |
|---|---|
| `calendar.mainUrl` | メインカレンダー埋込 URL |
| `calendar.embeds[].url` | カテゴリ別カレンダー URL |
| `forms.equipment.*` | 備品予約フォーム URL |
| `drive.circularFolderId` | 回覧板フォルダ ID |
| `drive.disasterManualUrl` | 防災マニュアル PDF URL |
| `trash.sheetUrl` | ゴミ収集スケジュール Sheets URL |
| `map.myMapsUrl` | Google My Maps 埋込 URL |
| `gallery.albums[].driveFolderId` | 写真アルバム フォルダ ID |

---

## Google サービス連携 設定手順

### 1. Google Calendar

1. [Google Calendar](https://calendar.google.com) を開く
2. 対象カレンダーの「...」→「設定と共有」を選択
3. 「このカレンダーを公開する」にチェックを入れて保存
4. 「カレンダーを埋め込む」セクションの `src=` 以降の URL をコピー
5. `js/config.js` の `calendar.mainUrl` に貼り付ける

```js
calendar: {
    mainUrl: "https://calendar.google.com/calendar/embed?src=xxxx%40group.calendar.google.com&ctz=Asia%2FTokyo"
}
```

---

### 2. Google Drive（回覧板・写真アルバム）

1. [Google Drive](https://drive.google.com) でフォルダを作成する  
   例: `若松町内会 > 回覧板 > 2026` のように年別に整理
2. フォルダを右クリック → 「共有」→ **リンクを知っている全員** に設定
3. フォルダの URL 末尾にある長い文字列（フォルダ ID）をコピー
4. `js/config.js` の `drive.circularFolderId` に設定する

```js
drive: {
    circularFolderId: "1ABCDEFGabcdef1234567890",
    circularFolderUrl: "https://drive.google.com/drive/folders/1ABCDEFGabcdef1234567890"
}
```

> **将来の Drive API 連携**: `js/drive.js` の `getDriveCircular()` 関数内の  
> `TODO` コメント箇所を Google Drive API の呼び出しへ置き換えます。

---

### 3. Google Forms（備品予約）

1. [Google Forms](https://forms.google.com) でフォームを作成する
2. 送信アイコン →「リンク」タブからフォーム URL をコピー
3. `js/config.js` の `forms` セクションへ貼り付ける

```js
forms: {
    equipment: {
        tent: "https://forms.gle/xxxxxxxxxxxx"
    }
}
```

---

### 4. Google Sheets（ゴミ収集スケジュール）

1. [Google スプレッドシート](https://sheets.google.com) で新規ファイルを作成する
2. 以下の構造で入力する:

| A: dayIndex | B: label | C: types |
|---|---|---|
| 1 | 月曜日 | 燃えるゴミ |
| 4 | 木曜日 | 燃えるゴミ |
| 5 | 金曜日 | 資源ゴミ |

3. ファイル → 共有 → **ウェブに公開** → JSON 形式を選択
4. 発行された URL を `js/config.js` の `trash.sheetUrl` に設定する

```js
trash: {
    sheetUrl: "https://docs.google.com/spreadsheets/d/xxxxx/gviz/tq?tqx=out:json"
}
```

> シートが公開されると `js/trash.js` が自動的に Sheets から読み込みます（モックデータは不要になります）。

---

### 5. Google My Maps（地域マップ）

1. [Google My Maps](https://www.google.com/mymaps) で新規マップを作成する
2. 集会所・避難所・AED・防災倉庫などをピンで追加する
3. 「共有」→ **リンクを知っている全員** に設定
4. 「地図を埋め込む」→ iframe の `src=` URL をコピー
5. `js/config.js` の `map.myMapsUrl` に設定する

```js
map: {
    myMapsUrl: "https://www.google.com/maps/d/u/0/embed?mid=xxxxxxxxxxxxxxxxxx"
}

---

### 6. 写真アルバム投稿（Google Drive）

1. Google Driveで写真保存用の親フォルダを作成
2. 既存の行事別フォルダ（夏祭り、防災訓練、清掃活動など）を作成
3. `js/config.js` の `gallery.destinations[].folderId` に各フォルダIDを設定
4. 新規フォルダ作成を有効にする場合は `gallery.drive.createFolderEndpoint` を設定
5. 写真アップロードを有効にする場合は `gallery.drive.uploadEndpoint` を設定

gallery.html では以下が利用できます。

- 保存先系統の選択（既存フォルダ）
- 新規フォルダ作成（Apps Script連携）
- 複数画像の投稿（Apps Script連携）
```

---

## 将来拡張ポイント

各フラグを `true` に変更することで追加機能を有効化できます（`js/config.js`）:

| フラグ | 機能 |
|---|---|
| `integrations.lineNotify` | LINE 通知 |
| `integrations.driveApiReady` | Drive API（PDF 自動取得） |
| `integrations.calendarApiReady` | Calendar API |
| `integrations.formsApiReady` | Forms API |
| `integrations.sheetsApiReady` | Sheets API（ゴミ収集自動取得） |
| `integrations.googleLoginReady` | Google ログイン（管理画面認証） |
| `integrations.memberManagementReady` | 会員管理 |
| `integrations.aiChatbotReady` | AI チャットボット |
| `integrations.disasterAlertReady` | 防災通知システム |


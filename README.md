# asoboon-stamp-rally

ASOBooN NFC スタンプラリー — **無料・最小構成**

| レイヤー | 使用サービス | 料金 |
|---|---|---|
| フロントエンド | **GitHub Pages** | 無料 |
| API | **Google Apps Script** (Web アプリ) | 無料 |
| DB | **Google スプレッドシート** | 無料 |

> Cloudflare・GitHub Actions・ビルドツール は一切使いません。

---

## 構成

```
asoboon-stamp-rally/
├── index.html          ← 本番フロントエンド本体（GitHub Pages root 公開）
├── frontend/
│   └── index.html      ← index.html と同一内容（参照用）
├── gas/
│   ├── Config.gs       ← スポット定義・定数
│   ├── Code.gs         ← API ロジック
│   └── appsscript.json ← GAS マニフェスト
└── README.md
```

### データフロー

```
NFC タグ (miniapp.line.me)
  └─▶ LIFF 起動 → index.html (GitHub Pages)
        ├─ liff.init() / liff.getIDToken() / liff.getContext()
        └─▶ POST GAS API  { action, spotId, idToken|lineUserId, ... }
              ├─ idToken → LINE API 検証 → sub (userId) 取得
              ├─ userId → SHA-256(type+value+visitDate+SECRET) → userKey
              ├─ stamps シートに保存 (userKey のみ保存、userId は保存しない)
              └─▶ { ok, stampList, stampedCount, completed, ... }
                    └─▶ フロントエンドに反映
```

---

## 1. GitHub Pages 設定

1. リポジトリ → **Settings** → **Pages**
2. **Source**: Deploy from a branch
3. **Branch**: `main` / **Folder**: `/ (root)`
4. 「Save」をクリック

公開 URL:
```
https://asoboon.github.io/asoboon-stamp-rally/
```

---

## 2. LINE Developers 設定

1. [LINE Developers Console](https://developers.line.biz/console/) → 該当チャネル → **LIFF タブ**
2. LIFF ID `2009888671-57TOefc3` を選択して以下を設定：

   | 項目 | 値 |
   |---|---|
   | エンドポイント URL | `https://asoboon.github.io/asoboon-stamp-rally/` |
   | Scope | `openid`, `profile` |
   | サイズ | `Full` |
   | Scan QR | `On` |

3. 「更新」をクリック

---

## 3. GAS 設定

### 3-1. スクリプト作成

1. [Google Apps Script](https://script.google.com) でプロジェクトを新規作成
2. ファイルを追加・編集：

   | GAS ファイル名 | 元ファイル |
   |---|---|
   | `Code.gs` (デフォルト) | `gas/Code.gs` |
   | `Config.gs` (追加) | `gas/Config.gs` |

   > `appsscript.json` は「プロジェクトの設定」→「appsscript.json マニフェストファイルをエディタで表示」で編集

### 3-2. スクリプトプロパティ設定

「プロジェクトの設定」→「スクリプト プロパティ」に追加：

| キー | 値 | 備考 |
|---|---|---|
| `ASOBOON_SPREADSHEET_ID` | スプレッドシート ID | 後述の手順で取得 |
| `ASOBOON_SECRET_KEY` | ランダム文字列 (32 文字以上) | userKey ハッシュ化用。**コードに書かない** |
| `ASOBOON_LIFF_ID` | `2009888671-57TOefc3` | チャネル ID 解決に使用 |
| `LINE_CHANNEL_ID` | LINE チャネル ID (任意) | 未設定なら LIFF ID のハイフン前を自動使用 |

### 3-3. スプレッドシート準備

1. [Google スプレッドシート](https://sheets.google.com) で新規ファイルを作成
2. URL の `/d/XXXXXXXX/edit` 部分 (スプレッドシート ID) をコピー
3. `ASOBOON_SPREADSHEET_ID` にセット

### 3-4. setupPrototype 実行

GAS エディタで関数セレクタから **`setupPrototype`** を選択して「▶ 実行」

- 初回のみ OAuth 権限確認 → 許可
- `spots` / `stamps` / `claims` / `settings` の 4 シートが作成される
- 毎日 4:00 (JST) に自動リセットするトリガーが設定される

### 3-5. Web アプリとしてデプロイ

「デプロイ」→「新しいデプロイ」→

| 項目 | 値 |
|---|---|
| 種類 | ウェブアプリ |
| 次のユーザーとして実行 | **自分** |
| アクセスできるユーザー | **全員** |

デプロイ後に表示される **ウェブアプリ URL** を確認し、`index.html` の `GAS_URL` と一致していることを確かめてください。

```js
// index.html (設定済み)
var GAS_URL = 'https://script.google.com/macros/s/AKfycbxILMUKf0jUEXi_t3quHWUuY0QwP8damcvnKUFY8OwFXoqcN7rfdEhi3vh2Yf8bzLiQLQ/exec';
```

> GAS を再デプロイして URL が変わった場合は `index.html` の `GAS_URL` を更新してください。

---

## 4. NFC タグ URL

各 NFC タグに書き込む URL：

| スポット | 名前 | NFC タグ URL |
|---|---|---|
| spot_01 | みまもり | `https://miniapp.line.me/2009888671-57TOefc3?spot=spot_01` |
| spot_02 | 飲食ルール | `https://miniapp.line.me/2009888671-57TOefc3?spot=spot_02` |
| spot_03 | 順番 | `https://miniapp.line.me/2009888671-57TOefc3?spot=spot_03` |
| spot_04 | 入退場 | `https://miniapp.line.me/2009888671-57TOefc3?spot=spot_04` |

---

## 5. 検証手順

1. **GitHub Pages 確認**
   `https://asoboon.github.io/asoboon-stamp-rally/` をブラウザで開く
   → ローディング → (LINE 未ログインなら) LINE ログイン画面が表示される

2. **GAS health check**
   ```
   https://<GAS_URL>?action=health
   ```
   → `{"ok":true,"status":"healthy","visitDate":"..."}` が返る

3. **curl テスト**
   ```bash
   curl -L -X POST "<GAS_URL>" \
     -H "Content-Type: text/plain;charset=utf-8" \
     -d '{"action":"stamp","spotId":"spot_01","lineUserId":"Utest00000000000000000001","idToken":"","timestamp":"2026-04-26T00:00:00.000Z"}'
   ```
   → `{"ok":true,"stampedCount":1,...}` が返る
   → スプレッドシートの `stamps` シートに行が追加される

4. **LINE ミニアプリ確認**
   LINE アプリで `https://miniapp.line.me/2009888671-57TOefc3?spot=spot_01` を開く
   → スタンプ 1/4 が表示される

5. **コンプリート確認**
   4 スポットすべてスキャン後、コンプリート画面とコンフェッティが表示される
   → `claims` シートに行が追加される

---

## 6. 失敗時の分岐

| エラーコード / 症状 | 原因 | 対処 |
|---|---|---|
| `LIFF_INIT_TIMEOUT` | LIFF エンドポイント URL が未設定または誤り | LINE Developers でエンドポイント URL を `https://asoboon.github.io/asoboon-stamp-rally/` に設定 |
| `LINE_USER_ID_EMPTY` | idToken・lineUserId ともに取得できない | LINE アプリ内から開く。Scope に `openid`, `profile` が設定されているか確認 |
| `API_TIMEOUT` | GAS 側の処理が 12 秒を超えた | GAS のスプレッドシート操作の遅延。スプレッドシート ID が正しいか確認 |
| `LINE_REQUIRED` | LIFF 外から開いた | LINE アプリ経由でアクセスするよう案内 |
| `INVALID_SPOT` | spot パラメータが不正 | NFC タグの URL が `?spot=spot_0X` 形式か確認 |
| `SAVE_FAILED` / `HTTP 5XX` | GAS 側エラー | GAS の「実行数」でスタックトレースを確認 |
| `ASOBOON_SPREADSHEET_ID が設定されていません` | スクリプトプロパティ未設定 | GAS プロジェクト設定でプロパティを追加 |
| `idToken 検証失敗` | LINE_CHANNEL_ID が誤り | LIFF ID のハイフン前の数字 = チャネル ID を確認 |
| スタンプが保存されない | `setupPrototype` 未実行 | GAS で `setupPrototype` を手動実行 |
| 翌日もスタンプが残る | 毎日リセットトリガーが未設定 | `installDailyResetTrigger` を再実行 |

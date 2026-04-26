# asoboon-stamp-rally

ASOBooN NFC スタンプラリー — Cloudflare Pages (フロントエンド) + Google Apps Script (API) 構成

---

## 構成

```
asoboon-stamp-rally/
├── frontend/
│   └── index.html        # Cloudflare Pages で配信するフロントエンド (ビルド不要)
├── gas/
│   ├── Config.gs         # スポット定義・定数
│   ├── Code.gs           # API ロジック (stamp / getStamps)
│   └── appsscript.json   # GAS マニフェスト (ランタイム V8 / スコープ)
└── README.md
```

### データフロー

```
NFC タグスキャン
  └─▶ LIFF URL (?spot=spot_XX)
        └─▶ frontend/index.html (Cloudflare Pages)
              ├─ liff.init() → idToken または userId 取得
              └─▶ POST GAS API  { action, spotId, idToken|userId }
                    ├─ idToken → LINE API で検証 → userId 取得
                    ├─ userId → HMAC-SHA256 ハッシュ → userKey
                    ├─ stamps シートに保存
                    └─▶ { success, stamps[], completed, alreadyStamped }
                          └─▶ フロントエンドに反映
```

---

## デプロイ手順

### 1. Google スプレッドシートの準備

1. [Google スプレッドシート](https://sheets.google.com) で新規シートを作成
2. URL の `/d/XXXX/edit` 部分をコピーしておく（スプレッドシート ID）

---

### 2. GAS のデプロイ

1. [Google Apps Script](https://script.google.com) でプロジェクトを新規作成
2. 左サイドバー「＋ ファイル」で以下を追加：
   - `Config.gs` → `gas/Config.gs` の内容を貼り付け
   - `Code.gs` (デフォルト) → `gas/Code.gs` の内容を貼り付け
3. 「プロジェクトの設定」→「スクリプト プロパティ」に以下を追加：

   | キー | 値 | 備考 |
   |---|---|---|
   | `ASOBOON_SPREADSHEET_ID` | スプレッドシート ID | 手順1で取得したもの |
   | `ASOBOON_SECRET_KEY` | 任意のランダム文字列 (32 文字以上推奨) | userId ハッシュ化に使用 |
   | `ASOBOON_LIFF_ID` | `2009888671-57TOefc3` | LINE チャネル ID の解決に使用 |
   | `LINE_CHANNEL_ID` | LINE チャネル ID (任意) | 未設定なら LIFF ID のハイフン前を自動使用 |

4. エディタ上部の関数セレクタで **`setup`** を選択して「▶ 実行」
   - 初回のみ OAuth 権限確認が表示されます → 許可してください
   - スプレッドシートに 4 シート (spots / stamps / claims / settings) が作成されます

5. 「デプロイ」→「新しいデプロイ」
   - 種類: **ウェブアプリ**
   - 次のユーザーとして実行: **自分**
   - アクセスできるユーザー: **全員**
   - 「デプロイ」をクリック → ウェブアプリ URL をコピー

6. `frontend/index.html` の `GAS_URL` が以下であることを確認（既に設定済み）：
   ```
   https://script.google.com/macros/s/AKfycbxILMUKf0jUEXi_t3quHWUuY0QwP8damcvnKUFY8OwFXoqcN7rfdEhi3vh2Yf8bzLiQLQ/exec
   ```
   GAS を再デプロイして URL が変わった場合は `index.html` の `GAS_URL` を更新してください。

---

### 3. Cloudflare Pages のデプロイ

1. [Cloudflare Pages](https://pages.cloudflare.com) にログイン
2. 「Create a project」→「Connect to Git」→ このリポジトリ (`asoboon/asoboon-stamp-rally`) を選択
3. ビルド設定：

   | 項目 | 値 |
   |---|---|
   | Framework preset | `None` |
   | Build command | (空欄) |
   | Build output directory | `frontend` |
   | Root directory | (空欄) |

4. 「Save and Deploy」→ デプロイ完了後に Pages URL (`https://xxxx.pages.dev`) をコピー

---

### 4. LINE Developers のエンドポイント URL 変更

1. [LINE Developers Console](https://developers.line.biz/console/) にログイン
2. 該当チャネル → 「LIFF」タブ → LIFF ID `2009888671-57TOefc3` を選択
3. 「エンドポイント URL」を Cloudflare Pages の URL に変更：
   ```
   https://xxxx.pages.dev
   ```
4. 「更新」をクリック

---

## NFC タグ URL

各 NFC タグには以下の URL を書き込んでください：

| スポット | 名前 | URL |
|---|---|---|
| spot_01 | みまもり | `https://miniapp.line.me/2009888671-57TOefc3?spot=spot_01` |
| spot_02 | 飲食ルール | `https://miniapp.line.me/2009888671-57TOefc3?spot=spot_02` |
| spot_03 | 順番 | `https://miniapp.line.me/2009888671-57TOefc3?spot=spot_03` |
| spot_04 | 入退場 | `https://miniapp.line.me/2009888671-57TOefc3?spot=spot_04` |

---

## 検証手順

### 動作確認ステップ

1. **GAS 単体確認**（curl で直接叩く）
   ```bash
   curl -L -X POST "https://script.google.com/macros/s/.../exec" \
     -d '{"action":"stamp","userId":"Utest123","spotId":"spot_01"}'
   ```
   期待レスポンス：
   ```json
   {"success":true,"stamps":[{"spotId":"spot_01","stampedAt":"..."}],"completed":false,"alreadyStamped":false,"currentSpot":"spot_01"}
   ```

2. **フロントエンド単体確認**
   - ブラウザで `https://xxxx.pages.dev?spot=spot_01` を開く
   - LIFF 未対応ブラウザでは LINE ログイン画面にリダイレクトされることを確認

3. **LINE ミニアプリ確認**
   - LINE アプリで `https://miniapp.line.me/2009888671-57TOefc3?spot=spot_01` を開く
   - スタンプカードが表示され、spot_01 にスタンプが入ることを確認

4. **コンプリート確認**
   - 4 スポットすべてスタンプ後、コンプリート画面とコンフェッティアニメーションを確認
   - スプレッドシートの `claims` シートに行が追加されることを確認

---

## 成功ログ

GAS の「実行数」に以下が記録されれば正常：

```
setup() 完了                          # 初回セットアップ
シート作成: spots                     # 初回のみ
```

スプレッドシート確認ポイント：

| シート | 確認内容 |
|---|---|
| `spots` | 4 行のスポットデータが存在する |
| `stamps` | スキャンのたびに行が追加される (userKey はハッシュ値) |
| `claims` | コンプリート時に行が追加される |

---

## 失敗時の分岐

| 症状 | 原因 | 対処 |
|---|---|---|
| `LIFF_INIT_TIMEOUT` | GAS HTML Service でホストしていた | Cloudflare Pages で配信することで解消済み |
| `ASOBOON_SPREADSHEET_ID が設定されていません。` | スクリプトプロパティ未設定 | GAS のプロジェクト設定でプロパティを追加 |
| `idToken 検証失敗` | LINE_CHANNEL_ID ミスマッチ | `LINE_CHANNEL_ID` を正しいチャネル ID に修正、または削除して自動解決に任せる |
| CORS エラー (DevTools) | GAS URL 誤りまたはデプロイ未反映 | GAS を再デプロイし `GAS_URL` を最新に更新 |
| スタンプが保存されない | `setup()` 未実行でシートがない | GAS で `setup()` を手動実行 |
| コンプリート後も完了画面が出ない | `stamps` シートに重複行があり count が不正 | スプレッドシートで対象 userKey の行を確認 |
| LINE アプリ外で開いてもスタンプされない | LIFF の仕様 | LINE アプリから開くよう案内、スタッフに LINE アプリ経由を徹底 |

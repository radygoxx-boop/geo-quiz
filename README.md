# 地理クイズ PWA(中学受験向け)

Notion で書いた問題が、毎朝自動でアプリに反映される4択クイズです。
サーバーは不要で、GitHub Pages だけで動きます。スマホのホーム画面に追加すると、オフラインでも遊べます。

```
Notion(問題を書く) → GitHub Actions(毎朝4時に questions.json を更新) → GitHub Pages(アプリを公開)
```

---

## ファイル構成

| ファイル | 役割 |
|---|---|
| `index.html` | アプリ本体(画面・デザイン・動きが全部入っています) |
| `questions.json` | 問題データ。Actions が自動で書きかえます(最初はサンプル48問) |
| `sw.js` | オフライン用の Service Worker |
| `manifest.json` | ホーム画面に追加するための設定 |
| `package.json` | 同期スクリプトが使う部品(@notionhq/client)の指定 |
| `.github/workflows/sync-notion.yml` | 毎朝の自動同期の設定 |
| `scripts/fetch-notion.js` | Notion から問題を取ってくるプログラム |
| `scripts/categories.js` | **分野名・難易度名の定義(ここだけで管理)** |
| `images/chars/*.svg` | 図鑑キャラの画像(43枚。仮の絵です) |
| `images/icons/*` | アプリのアイコン |
| `.nojekyll` | GitHub Pages でファイルをそのまま公開するための空ファイル |

---

## はじめにやること(手順1〜6)

### 1. GitHub にリポジトリを作って、全ファイルをアップロード

1. GitHub で「New repository」を押す
2. 名前を決める(例: `geo-quiz`)。**Public** を選んで「Create repository」
3. 「uploading an existing file」から、このフォルダの中身を**全部**ドラッグ&ドロップして「Commit changes」

> ⚠️ `.github` と `scripts` フォルダ、`.nojekyll` も必ず含めてください。
> 名前が「.」で始まるファイルは、パソコンの設定によっては見えません。
> Mac は Finder で `Command + Shift + .`、Windows はエクスプローラーの「表示 → 隠しファイル」で表示できます。
> ブラウザでうまく上げられないときは、GitHub Desktop を使うと確実です。

### 2. Notion でインテグレーションを作り、問題DBにつなぐ

1. https://www.notion.so/profile/integrations を開き「新しいインテグレーション」を作成
   - 種類: 内部(Internal)/ 名前: 例「地理クイズ同期」/ 機能: 「コンテンツを読み取る」だけでOK
2. 表示される「シークレット」(`ntn_` や `secret_` で始まる文字列)をコピーしておく → これが **NOTION_API_KEY**
3. Notion で問題DBを作る(列の作り方は下の「Notion DB の作り方」を参照)
4. 問題DBのページ右上の「…」→「接続」(Connections)→ 作ったインテグレーションを追加
5. 問題DBをブラウザで開き、URLの次の部分をコピー → これが **NOTION_DATABASE_ID**

```
https://www.notion.so/xxxx/【ここの32文字】?v=yyyy
```

> URLをまるごと貼っても、スクリプトが32文字を自動で取り出します。

### 3. GitHub に秘密の鍵を登録

リポジトリの **Settings → Secrets and variables → Actions → New repository secret** で、次の2つを登録します。

| Name | Secret |
|---|---|
| `NOTION_API_KEY` | 手順2-2 のシークレット |
| `NOTION_DATABASE_ID` | 手順2-5 のID |

> 鍵はコードに書かないでください(Public リポジトリは誰でも見られます)。

### 4. GitHub Pages を有効にする

**Settings → Pages → Build and deployment**
- Source: `Deploy from a branch`
- Branch: `main` / `(root)` → **Save**

1〜2分でサイトが公開されます。

### 5. 初回の同期を手動で実行

**Actions** タブ → 左の「sync-notion」→ 右の「Run workflow」→ 緑の「Run workflow」。
緑のチェックが付けば成功です。Notion に「完成」の問題があれば、`questions.json` が自動で書きかわります。

> Notion にまだ問題がない(または「完成」が0件)ときは、サンプル問題のまま残ります。

### 6. 動作確認

```
https://{ユーザー名}.github.io/{リポジトリ名}/
```

スマホで開いて、ホーム画面に追加すると全画面で遊べます。
- iPhone: Safari で開く → 共有ボタン → 「ホーム画面に追加」
- Android: Chrome で開く → メニュー「︙」→「ホーム画面に追加」(または「アプリをインストール」)

---

## 7. 問題の追加のしかた

1. Notion の問題DBに新しい行を作り、各列を入力する
2. 見直しが終わったら、**ステータスを「完成」にする**(「完成」以外は取り込まれません)
3. 次のどちらかで反映されます
   - 翌朝 4:00(日本時間)の自動同期を待つ
   - すぐ反映したいときは Actions → sync-notion → **Run workflow**
4. アプリを開き直すと新しい問題が出ます

- 出題順は、**Notion で行を作った順**です。DBの「No」列(GEO-1, GEO-2 … と自動で付く連番)の小さい順に並びます(Notion の並べ替え表示は関係ありません)。順番を変えたいときは、行を作り直してください
- 問題を消したいときは、行を削除するより**ステータスを「下書き」に戻す**のが確実です。
  行を削除した場合は、Run workflow のときに「変更がなくても全件取り込み直す」にチェックを入れて実行してください
- 変更がない日は何もコミットされません(ログに `NO_CHANGE` と出ます)

---

## 8. 出題数・出題順の変え方

`index.html` の `<script>` のすぐ下にある、囲み枠の「出題設定」を書きかえます。

```js
const QUESTION_LIMIT = null;    // null=全問、数字=上限問題数
const QUESTION_ORDER = 'fixed'; // 'fixed'=追加順、'random'=ランダム
const CLEAR_RATE = 0.8;         // クリアに必要な正答率
```

| やりたいこと | 書き方 |
|---|---|
| 全問を追加順に出す(最初の設定) | `QUESTION_LIMIT = null;` `QUESTION_ORDER = 'fixed';` |
| ランダムに10問だけ出す | `QUESTION_LIMIT = 10;` `QUESTION_ORDER = 'random';` |

> ⚠️ `index.html` や画像を書きかえたときは、`sw.js` の `CACHE_NAME` の数字を1つ上げてください
> (例: `'geo-quiz-v1'` → `'geo-quiz-v2'`)。上げないと、スマホに古いアプリが残ります。
> `questions.json`(問題)の更新だけなら、上げる必要はありません。

---

## 9. 分野名の表記ルールと、よくあるトラブル

### 表記ルール(完全一致が必須)

Notion の選択肢名は、`scripts/categories.js` の定義と**1文字も違わず**同じにしてください。

| 分野ID | Notion の選択肢名 |
|---|---|
| hokkaido_tohoku | 北海道・東北 |
| kanto | 関東 |
| chubu | 中部 |
| kinki | 近畿 |
| chugoku_shikoku | 中国・四国 |
| kyushu | 九州・沖縄 |
| world | 世界地理 |
| industry | 産業・地図 |

| 難易度 | 注意 |
|---|---|
| `★ やさしい` | ★の後ろは**半角スペース** |
| `★★ ふつう` | 同上 |
| `★★★ むずかしい` | 同上 |

- 「・」は全角の中黒です(`北海道・東北`)。「/」や半角の「･」は別の文字になります
- ズレがあると、その問題はスキップされ、Actions のログに黄色い警告(⚠)が出ます
- スペースだけの違い(例: `★やさしい`)は警告を出したうえで取り込みます
- **分野を変えたいとき**は `scripts/categories.js` だけを書きかえ、Notion の選択肢も同じ名前にしてから Run workflow を実行します(アプリの分野一覧も自動で変わります)。分野IDを変えた場合は、キャラ画像のファイル名と `index.html` の `CHARACTERS` の `field` もそろえてください

### 問題がアプリに出ない

| 確認すること | 対処 |
|---|---|
| ステータスが「完成」か | 「完成」にして Run workflow |
| Actions のログに警告が出ていないか | Actions → 最新の実行 → 「Notion から問題を取得」を開いて ⚠ を読む |
| 分野・難易度の名前 | 上の表記ルールどおりか確認 |
| 選択肢が4つ全部埋まっているか、正解が A〜D か | 足りない問題はスキップされます |
| アプリが古いまま | アプリを完全に閉じて開き直す。それでもだめなら、ブラウザで一度開いて再読み込み |
| `questions.json` は新しいのにサイトが古い | Actions タブの「pages build and deployment」が成功しているか確認。止まっていたら Settings → Pages で一度 Save し直す |

### Actions が赤くなる(失敗する)

ログの一番下の赤いエラー(`::error::`)を読んでください。よくある原因は次のとおりです。

| エラーの内容 | 原因と対処 |
|---|---|
| `NOTION_API_KEY または NOTION_DATABASE_ID が設定されていません` | 手順3の Secrets の名前が違う(大文字・アンダースコアまで同じに) |
| `unauthorized` / `API token is invalid` | シークレットのコピーミス。インテグレーション画面からコピーし直して登録し直す |
| `object_not_found` / `Could not find database` | DBにインテグレーションを「接続」していない、またはDBのIDが違う |
| `validation_error` | 列名(特に「ステータス」)が違う、または型が違う |
| `git push` で失敗 | Settings → Actions → General → Workflow permissions を「Read and write permissions」にする |

### その他

- 自動同期が止まった: Public リポジトリは、60日間コミットがないと定期実行が自動で止まります。Actions タブに出る「Enable workflow」を押してください
- 記録(クリア状況・図鑑)は端末のブラウザに保存されます。別の端末とは共有されません
- 図鑑キャラの絵を変えたい: `images/chars/` の同じ名前のファイルを差しかえ、`sw.js` の `CACHE_NAME` を上げます(SVG のほか、同じ名前にすれば中身は好きな絵でOK。正方形がきれいに表示されます)

---

## Notion DB の作り方

### 列(プロパティ)

| 列名 | 種類 | 選択肢 / 説明 |
|---|---|---|
| 問題文 | タイトル | 問題の文 |
| 選択肢A〜選択肢D | テキスト | 4つとも必須 |
| 正解 | セレクト | A / B / C / D |
| 難易度 | セレクト | ★ やさしい / ★★ ふつう / ★★★ むずかしい |
| 分野 | セレクト | 上の8つ |
| ヒント文 | テキスト | 回答後に「解説」として表示 |
| ステータス | セレクト | 下書き / レビュー待ち / 完成(「完成」のみ取り込み) |
| メモ | テキスト | アプリでは使いません |
| 出典準拠 | チェックボックス | アプリでは使いません |
| No | ID(自動連番) | 出題順に使います。接頭辞は GEO。自動で付くので入力不要 |

> 「ステータス」は Notion の「ステータス」型で作っても動きます(選択肢名が同じなら可)。
> 「No」列がない場合は作成日時の順になりますが、作成日時は分単位なので、同じ1分間に作った問題の順番は保証されません。

### SQL DDL 形式(Notion AI や Notion の MCP などで、そのまま作成できます)

```sql
CREATE TABLE (
  "問題文" TITLE,
  "選択肢A" RICH_TEXT,
  "選択肢B" RICH_TEXT,
  "選択肢C" RICH_TEXT,
  "選択肢D" RICH_TEXT,
  "正解" SELECT('A':blue, 'B':green, 'C':orange, 'D':purple),
  "難易度" SELECT('★ やさしい':green, '★★ ふつう':yellow, '★★★ むずかしい':red),
  "分野" SELECT('北海道・東北':blue, '関東':orange, '中部':green, '近畿':red, '中国・四国':purple, '九州・沖縄':pink, '世界地理':brown, '産業・地図':gray),
  "ヒント文" RICH_TEXT,
  "ステータス" SELECT('下書き':gray, 'レビュー待ち':yellow, '完成':green),
  "メモ" RICH_TEXT,
  "出典準拠" CHECKBOX,
  "No" UNIQUE_ID PREFIX 'GEO'
)
```

---

## ゲームのしくみ

- 分野 → 難易度をえらんで挑戦。正答率80%以上で、その難易度が「クリア」になります
- クリアするたびに、その分野のキャラが1体もらえます(まだ持っていないキャラが優先。N が出やすく SR は出にくい)
- 8分野すべてをクリアしたあと、満点を取ると5%の確率でシークレットキャラが出現します
- スコアは1問100点。連続正解(コンボ)でボーナスが加算されます

## 補足(開発者向け)

- `@notionhq/client` は 2.2.15 に固定しています。新しい版(v5 以降)は Notion API の仕組みが変わっており、このスクリプトのままでは動かないためです
- ローカルで同期を試す: `npm install` のあと `NOTION_API_KEY=... NOTION_DATABASE_ID=... node scripts/fetch-notion.js`
- `questions.json` には仕様の `generatedAt` / `questions` に加えて、分野と難易度の定義(`fields` / `difficulties`)も書き出しています。アプリはこれを読んで分野一覧を作ります

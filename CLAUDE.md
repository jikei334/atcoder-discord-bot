# AtCoder Discord Bot

## 概要

社内のAtCoder参加を自己申告・集計・ランキング発表するDiscord Bot。
Node.js + TypeScript + discord.js で実装する。

## 技術スタック

- Runtime: Node.js
- Language: TypeScript
- Discord Library: discord.js v14
- データ保存: JSONファイル（`data/` ディレクトリ）
- パッケージマネージャー: npm

## ディレクトリ構成

```
/
├── src/
│   ├── index.ts          # エントリポイント
│   ├── commands/
│   │   ├── register.ts   # /register
│   │   ├── report.ts     # /report
│   │   ├── ranking.ts    # /ranking
│   │   ├── export.ts     # /export
│   │   └── setperiod.ts  # /setperiod（管理者専用）
│   ├── tasks/
│   │   └── weeklyRanking.ts  # 週次自動投稿
│   ├── api/
│   │   └── atcoder.ts    # AtCoder API クライアント
│   └── data/
│       └── store.ts      # JSONデータ読み書き
├── data/
│   ├── users.json        # Discord ID ↔ AtCoder ID 紐づけ
│   ├── reports.json      # 参加報告データ
│   └── config.json       # 管理者設定（集計期間開始日など）
├── .env                  # DISCORD_TOKEN, GUILD_ID, RANKING_CHANNEL_ID
├── .env.example          # .envのテンプレート（トークンなし）
├── Dockerfile
├── compose.yaml
├── .dockerignore
├── package.json
└── tsconfig.json
```

## コマンド仕様

### `/register <atcoder_id>`

- AtCoder ID を Discord ユーザーに紐づける（任意、使用必須ではない）
- **必ずエフェメラル（自分にだけ見える）で返答する**（他のメンバーに AtCoder ID を見せないため）
- 既に登録済みの場合は上書き確認なしで更新する
- AtCoder ID の実在確認は行わない（社内の信頼ベース）

### `/report`

- 参加報告を行う
- **`/register` は不要**。Discord アカウントさえあれば誰でも報告できる
- `/register` 済みの場合は AtCoder Problems API からその人の提出データを取得し、解いた問題を自動チェックした状態で表示する（未登録の場合はすべて未チェック）
- セレクトメニュー + ボタンの組み合わせで実装（モーダルは使わない）
- フロー：
  1. コンテスト選択（AtCoder API から直近のコンテスト候補を取得、セレクトメニュー）
  2. 解いた問題選択（コンテストの問題数に合わせた動的なトグルボタン、`/register` 済みなら AC 済み問題を自動チェック）
  3. 一言感想入力（任意、テキスト入力）
  4. 送信
- 同一コンテストへの重複報告は**上書き**（既存レコードを更新する）
- 報告完了後、チャンネルに以下の形式で投稿する：
  ```
  🎉 ユーザー名 が ABC400 に参加！
  ✅ 解いた問題: A, B, C, D（4完）
  💬「Dまで順調だった」
  ```
- `ユーザー名` は Discord の DisplayName を使う（AtCoder ID は表示しない）

### `/ranking`

- 集計期間内の参加回数ランキングをエフェメラルで表示
- 集計期間は `data/config.json` に保存された開始日〜現在
- **上位3人 + 自分**（自分が上位3位以内でなければ自分の順位も追加表示）
- 3カテゴリのセクションを1メッセージ内に並べて表示：
  1. **アルゴリズム全体**（ABC + ARC + AGC + AWC + Other の合計）
  2. **ABCのみ**
  3. **ヒューリスティック**（AHC-Short + AHC-Long の合計）
- 各セクション内の種別内訳も表示

### `/setperiod`

- 集計期間の開始日を設定する（管理者専用コマンド）
- **「管理者」ロールを持つユーザーのみ実行可能**（それ以外はエフェメラルでエラー）
- 引数なし。コマンド実行後にセレクトメニューで年→月→日の順に選択する（打ち間違い防止）
- 設定値は `data/config.json` に保存
- すべてのやり取りはエフェメラル

### `/export`

- 参加データを CSV でダウンロードできる形式で返す
- 権限制限なし（全員使用可）
- CSV の内容：Discord DisplayName, ABC参加数, ARC参加数, AGC参加数, AHC-Short参加数, AHC-Long参加数, AWC参加数, その他参加数, 合計参加数
- **AtCoder ID は CSV に含めない**

## 自動タスク

### 週次ランキング自動投稿

- タイミング: 毎週月曜 9:00 JST
- 投稿先: 環境変数 `RANKING_CHANNEL_ID` で指定したチャンネル
- **スレッドに投稿**してメインチャンネルを汚さない
  - メインチャンネルに「📊 今週のランキング」と1行投稿
  - スレッド内にランキングを掲載
- 集計期間: 直前の月曜〜日曜
- **上位3人のみ表示**（全員表示はしない）
- 表示形式例：
  ```
  📊 週次ランキング（6/1〜6/7）

  🥇 Alice    ABC×3, ARC×1           計4回
  🥈 Bob      ABC×2, AHC(Long)×1     計3回
  🥉 Carol    ABC×1, AGC×1           計2回
  ```
- 参加者が0人の週はスキップ

## データ形式

### `data/users.json`

```json
{
  "discord_user_id_1": {
    "atcoderId": "jikei",
    "discordDisplayName": "Alice"
  }
}
```

### `data/reports.json`

```json
[
  {
    "id": "uuid",
    "discordUserId": "discord_user_id_1",
    "discordDisplayName": "Alice",
    "contestId": "abc400",
    "contestName": "ABC400",
    "contestType": "ABC",
    "solvedProblems": ["A", "B", "C", "D"],
    "comment": "Dまで順調だった",
    "reportedAt": "2025-06-01T14:30:00+09:00"
  }
]
```

### `data/config.json`

```json
{
  "periodStartDate": "2025-06-01"
}
```

### contestType の種別

`ABC` / `ARC` / `AGC` / `AHC-Short` / `AHC-Long` / `AWC` / `Other`

AHC のショート・ロングは AtCoder Problems API の `duration_second` で自動判定：
- `duration_second < 86400`（1日未満）→ `AHC-Short`
- `duration_second >= 86400`（1日以上）→ `AHC-Long`

## AtCoder API

AtCoder には公式 API がないため、以下を利用する（AtCoder Problems）：
- コンテスト一覧: `https://kenkoooo.com/atcoder/resources/contests.json`
  - 直近コンテストの候補表示に使用（過去2週間 + 今後1週間を対象）
  - `duration_second` フィールドを AHC のショート/ロング判定に使用
- ユーザー提出一覧: `https://kenkoooo.com/atcoder/atcoder-api/v3/user/submissions?user={atcoder_id}&from_second={epoch}`
  - `/report` でコンテスト選択後、そのコンテストの AC 済み問題を自動チェックするために使用
  - `from_second` にはコンテスト開始時刻を指定して絞り込む（最大500件返却）

## 環境変数（.env）

```
DISCORD_TOKEN=
CLIENT_ID=
GUILD_ID=
RANKING_CHANNEL_ID=
```

## 実装上の注意

- discord.js v14 のスラッシュコマンドは `REST` + `Routes.applicationGuildCommands` でデプロイする
- コマンドデプロイ用スクリプト（`npm run deploy`）を用意する
- JSONファイルの読み書きは排他制御を考慮すること（同時書き込みを避ける）
- エラー時は必ずエフェメラルでユーザーにフィードバックを返す
- `/register` と `/setperiod` の返答は **常にエフェメラル**（`ephemeral: true`）にすること
- `/report` のUI はセレクトメニュー + ボタンで実装（モーダル不使用）
- `/report` で問題選択ボタンはコンテストの問題数に合わせて動的に生成する

## 起動方法

```bash
npm install
npm run deploy   # スラッシュコマンドを Discord に登録
npm run dev      # 開発時（ts-node）
npm run build    # ビルド
npm start        # 本番起動
```

## コンテナ構成

Podman（rootless）での運用を想定する。Docker Composeとも互換性を持たせる。

### Dockerfile

マルチステージビルドで本番イメージを軽量化する。

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
# dataディレクトリはボリュームマウントで外部管理
RUN mkdir -p /app/data
CMD ["node", "dist/index.js"]
```

### compose.yaml

```yaml
services:
  bot:
    build: .
    restart: unless-stopped
    env_file: .env
    volumes:
      - ./data:/app/data   # JSONデータをホスト側で永続化
```

### 運用コマンド（Podman）

```bash
# ビルド＆起動
podman compose up -d --build

# スラッシュコマンドのデプロイ（初回・更新時のみ）
podman compose run --rm bot node dist/deploy.js

# ログ確認
podman compose logs -f

# 停止
podman compose down
```

### 注意事項

- `data/` ディレクトリはボリュームマウントでコンテナ外に永続化する（コンテナを再ビルドしてもデータが消えないようにする）
- `.env` はコンテナにコピーせず `env_file` で注入する
- `.dockerignore` に `data/`, `.env`, `node_modules/` を含める
- `npm run deploy`（コマンド登録）はコンテナ起動時に毎回実行せず、別途手動実行する（Discordのレート制限対策）

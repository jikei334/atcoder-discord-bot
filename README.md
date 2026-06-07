# AtCoder Discord Bot

社内のAtCoder参加を自己申告・集計・ランキング発表するDiscord Bot。

## 実装状況

### コマンド

| 状況 | コマンド | 説明 |
|------|----------|------|
| [ ] | `/register <atcoder_id>` | AtCoder ID を Discord ユーザーに紐づける |
| [ ] | `/report` | コンテスト参加を報告する（セレクトメニュー＋ボタン） |
| [ ] | `/ranking` | 集計期間内の参加回数ランキングを表示（3カテゴリ、上位3人＋自分） |
| [ ] | `/setperiod <date>` | 集計期間の開始日を設定する（管理者専用） |
| [ ] | `/export` | 参加データを CSV でエクスポートする |

### 自動タスク

| 状況 | 機能 | 説明 |
|------|------|------|
| [ ] | 週次ランキング自動投稿 | 毎週月曜 9:00 JST にランキングをスレッド投稿（上位3人） |

## 起動方法

### 前提

`.env` ファイルを作成して以下の環境変数を設定してください。

```
DISCORD_TOKEN=
GUILD_ID=
RANKING_CHANNEL_ID=
```

### 開発時

```bash
npm install
npm run deploy   # スラッシュコマンドを Discord に登録（初回・更新時のみ）
npm run dev      # 開発用起動（ts-node）
```

### 本番（ローカル）

```bash
npm run build
npm start
```

### 本番（コンテナ）

```bash
podman compose up -d --build

# スラッシュコマンドのデプロイ（初回・更新時のみ）
podman compose run --rm bot node dist/deploy.js

# ログ確認
podman compose logs -f
```

## インフラ

| 状況 | 項目 | 説明 |
|------|------|------|
| [ ] | コマンドデプロイスクリプト | `npm run deploy` でスラッシュコマンドを Discord に登録 |
| [ ] | Dockerfile | マルチステージビルドで本番イメージを軽量化 |
| [ ] | compose.yaml | Podman / Docker Compose でのコンテナ起動設定 |

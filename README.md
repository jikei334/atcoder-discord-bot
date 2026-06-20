# AtCoder Discord Bot

社内のAtCoder参加を自己申告・集計・ランキング発表するDiscord Bot。

## 実装状況

### コマンド

| 状況 | コマンド | 説明 |
|------|----------|------|
| [x] | `/help` | Bot の使い方を表示する |
| [x] | `/register <atcoder_id>` | AtCoder ID を Discord ユーザーに紐づける |
| [x] | `/report` | コンテスト参加を報告する（セレクトメニュー＋ボタン） |
| [x] | `/ranking` | 集計期間内の参加回数ランキングを表示（3カテゴリ、上位3人＋自分） |
| [x] | `/setperiod` | 集計期間の開始日を設定する（管理者専用） |
| [x] | `/export` | 参加データを CSV でエクスポートする |

### 自動タスク

| 状況 | 機能 | 説明 |
|------|------|------|
| [x] | 週次ランキング自動投稿 | 毎週月曜 9:00 JST にランキングをスレッド投稿（上位3人） |

## 起動方法

### 前提

`.env` ファイルを作成して以下の環境変数を設定してください。

```
DISCORD_TOKEN=
CLIENT_ID=
GUILD_ID=
RANKING_CHANNEL_ID=
POSTGRES_PASSWORD=
DATABASE_URL=postgresql://atcoder:YOUR_PASSWORD@postgres:5432/atcoder
```

> `POSTGRES_PASSWORD` と `DATABASE_URL` 内のパスワード部分は同じ値にしてください。

#### 各値の取得方法

**`DISCORD_TOKEN` と `CLIENT_ID`（Bot トークンとアプリケーション ID）**

1. [Discord Developer Portal](https://discord.com/developers/applications) にアクセスしてログイン
2. 「New Application」でアプリケーションを作成
3. 左メニューの「General Information」→ **Application ID** が `CLIENT_ID`
4. 左メニューの「Bot」→「Reset Token」でトークンを発行 → **Token** が `DISCORD_TOKEN`
   - トークンは一度しか表示されないため、必ず控えておくこと

**`GUILD_ID`（Discord サーバーの ID）**

1. Discord アプリの設定 →「詳細設定」→「開発者モード」をオン
2. Bot を追加したいサーバーを右クリック →「IDをコピー」→ これが `GUILD_ID`

**`RANKING_CHANNEL_ID`（ランキングを投稿するチャンネルの ID）**

1. 開発者モードをオンにした状態で、投稿先チャンネルを右クリック →「IDをコピー」→ これが `RANKING_CHANNEL_ID`

#### Bot をサーバーに追加する

1. Developer Portal の「OAuth2」→「URL Generator」を開く
2. Scopes で `bot` と `applications.commands` にチェック
3. Bot Permissions で以下にチェック：
   - `Send Messages`
   - `Create Public Threads`
   - `Send Messages in Threads`
4. 生成された URL をブラウザで開き、サーバーに Bot を追加

### 開発時

開発時は別途 PostgreSQL が必要です。ローカルで PostgreSQL を起動するか、コンテナのみ先に立ち上げてください。

```bash
# PostgreSQL だけ先に起動
podman compose up -d postgres

npm install
npm run deploy   # スラッシュコマンドを Discord に登録（初回・更新時のみ）
npm run dev      # 開発用起動（ts-node）
```

> 開発時の `DATABASE_URL` はホスト側から接続するため `@localhost:5432` に変更してください。

### 本番（コンテナ）

```bash
podman compose up -d --build

# スラッシュコマンドのデプロイ（初回・更新時のみ）
podman compose run --rm bot node dist/deploy.js

# ログ確認
podman compose logs -f
```

PostgreSQL のデータは `./postgres_data/` ディレクトリに保存されます。

## AWS へのデプロイ（CDK）

### 前提

- AWS CloudShell（または AWS CLI + CDK 設定済みの環境）
- CloudShell には CDK が最初からインストールされています

#### 初回セットアップ

```bash
# リポジトリをクローン
git clone --branch aws https://github.com/jikei334/atcoder-discord-bot.git
cd atcoder-discord-bot/cdk
npm install

# CDK 用 S3 バケット等を作成（アカウント・リージョンごとに一度だけ）
cdk bootstrap
```

### デプロイ（EC2 インスタンスの作成）

```bash
cd cdk
cdk deploy
```

デプロイ後に表示される `ConnectCommand` を使って SSM で接続し、`.env` を作成します。

```bash
# SSM で接続（デプロイ後に表示されるコマンドをコピー）
aws ssm start-session --target i-xxxxxxxxxxxxxxxxx --region ap-northeast-1

# 接続後
cd /opt/atcoder-bot
cp .env.example .env
vi .env                                                      # 各値を設定
systemctl enable --now atcoder-bot                           # 起動 & 自動起動設定
docker-compose run --rm bot node dist/deploy.js              # スラッシュコマンド登録
```

### 全リソースの削除（使い終わったとき）

```bash
cd cdk
cdk destroy
```

これだけで EC2・セキュリティグループ・IAM ロールがすべて削除されます。

### ログ確認

```bash
journalctl -u atcoder-bot -f          # Bot のログ
cat /var/log/atcoder-bot-setup.log    # 初回セットアップログ
```

## インフラ

| 状況 | 項目 | 説明 |
|------|------|------|
| [x] | コマンドデプロイスクリプト | `npm run deploy` でスラッシュコマンドを Discord に登録 |
| [x] | Dockerfile | マルチステージビルドで本番イメージを軽量化 |
| [x] | compose.yaml | Podman / Docker Compose でのコンテナ起動設定（PostgreSQL 同梱） |

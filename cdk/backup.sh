#!/bin/bash
# cdk deploy 前に自動実行されるバックアップスクリプト
# バックアップ先: EC2内 /opt/atcoder-bot/backups/ (EBS上)

set -euo pipefail

STACK_NAME="AtcoderBotStack"
REGION="${AWS_DEFAULT_REGION:-ap-northeast-1}"

echo "=== バックアップ開始 ==="

# CloudFormation からインスタンス ID を取得
INSTANCE_ID=$(aws cloudformation describe-stack-resources \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query "StackResources[?ResourceType=='AWS::EC2::Instance'].PhysicalResourceId" \
  --output text 2>/dev/null || true)

if [ -z "$INSTANCE_ID" ]; then
  echo "インスタンスが見つかりません。初回デプロイとみなしてスキップします。"
  exit 0
fi

echo "Instance: $INSTANCE_ID"

# EC2 上で実行するスクリプトを Base64 エンコード
REMOTE_SCRIPT=$(base64 -w0 << 'REMOTE'
#!/bin/bash
set -euo pipefail
TIMESTAMP=$(date -u +%Y-%m-%d_%H-%M)
BACKUP_DIR=/opt/atcoder-bot/backups
BACKUP_FILE="${BACKUP_DIR}/atcoder_${TIMESTAMP}.sql.gz"
mkdir -p "$BACKUP_DIR"
PGPASS=$(grep '^POSTGRES_PASSWORD=' /opt/atcoder-bot/.env | cut -d= -f2-)
/usr/local/bin/docker-compose -f /opt/atcoder-bot/compose.yaml exec -T \
  -e PGPASSWORD="$PGPASS" \
  postgres pg_dump -U atcoder atcoder | gzip > "$BACKUP_FILE"
ls -lh "$BACKUP_FILE"
echo "=== バックアップ完了: $BACKUP_FILE ==="
REMOTE
)

# SSM コマンド送信
TMPFILE=$(mktemp)
cat > "$TMPFILE" << EOF
{
  "InstanceIds": ["$INSTANCE_ID"],
  "DocumentName": "AWS-RunShellScript",
  "Parameters": {
    "commands": ["echo ${REMOTE_SCRIPT} | base64 -d | bash"]
  }
}
EOF

COMMAND_ID=$(aws ssm send-command \
  --cli-input-json "file://$TMPFILE" \
  --region "$REGION" \
  --query "Command.CommandId" \
  --output text)
rm "$TMPFILE"

echo "実行中... (Command: $COMMAND_ID)"

aws ssm wait command-executed \
  --command-id "$COMMAND_ID" \
  --instance-id "$INSTANCE_ID" \
  --region "$REGION"

STATUS=$(aws ssm get-command-invocation \
  --command-id "$COMMAND_ID" \
  --instance-id "$INSTANCE_ID" \
  --region "$REGION" \
  --query "Status" \
  --output text)

if [ "$STATUS" = "Success" ]; then
  aws ssm get-command-invocation \
    --command-id "$COMMAND_ID" \
    --instance-id "$INSTANCE_ID" \
    --region "$REGION" \
    --query "StandardOutputContent" \
    --output text
  echo "✅ バックアップ成功"
else
  aws ssm get-command-invocation \
    --command-id "$COMMAND_ID" \
    --instance-id "$INSTANCE_ID" \
    --region "$REGION" \
    --query "StandardErrorContent" \
    --output text
  echo "❌ バックアップ失敗 (Status: $STATUS)"
  exit 1
fi

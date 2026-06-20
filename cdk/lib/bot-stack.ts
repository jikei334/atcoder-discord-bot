import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

const REPO_URL = 'https://github.com/jikei334/atcoder-discord-bot.git';
const REPO_BRANCH = 'aws';

export class BotStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // IAM ロール（SSM Session Manager でキーペア不要でアクセスするため）
    const role = new iam.Role(this, 'BotRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
      ],
    });

    // デフォルト VPC を使用
    const vpc = ec2.Vpc.fromLookup(this, 'DefaultVpc', { isDefault: true });

    // セキュリティグループ（アウトバウンドのみ。インバウンド不要）
    const sg = new ec2.SecurityGroup(this, 'BotSg', {
      vpc,
      description: 'AtCoder Discord Bot - outbound only',
      allowAllOutbound: true,
    });

    // 初回起動時に実行されるセットアップスクリプト
    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      'set -euo pipefail',
      'exec > /var/log/atcoder-bot-setup.log 2>&1',

      // Docker インストール
      'dnf install -y docker git',
      'systemctl enable --now docker',

      // Docker Compose インストール
      'COMPOSE_VERSION=$(curl -fsSL https://api.github.com/repos/docker/compose/releases/latest | grep \'"tag_name"\' | sed \'s/.*"v\\([^"]*\\)".*/\\1/\')',
      'curl -fsSL "https://github.com/docker/compose/releases/download/v${COMPOSE_VERSION}/docker-compose-linux-x86_64" -o /usr/local/bin/docker-compose',
      'chmod +x /usr/local/bin/docker-compose',

      // リポジトリのクローン
      `git clone --branch ${REPO_BRANCH} ${REPO_URL} /opt/atcoder-bot`,

      // PostgreSQL コンテナ（UID 999）がアクセスできるようパーミッション設定
      'mkdir -p /opt/atcoder-bot/postgres_data',
      'chown 999:999 /opt/atcoder-bot/postgres_data',

      // SSM 接続ユーザー（ssm-user）が .env を作成・編集できるよう書き込み権限を付与
      'chmod o+w /opt/atcoder-bot',

      // systemd サービス登録（.env 作成後に手動で有効化）
      `cat > /etc/systemd/system/atcoder-bot.service << 'EOF'
[Unit]
Description=AtCoder Discord Bot
After=docker.service
Requires=docker.service

[Service]
WorkingDirectory=/opt/atcoder-bot
ExecStart=/usr/local/bin/docker-compose up
ExecStop=/usr/local/bin/docker-compose down
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF`,
      'systemctl daemon-reload',
      'echo "=== セットアップ完了 ==="',
    );

    // EC2 インスタンス
    const instance = new ec2.Instance(this, 'BotInstance', {
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      machineImage: ec2.MachineImage.latestAmazonLinux2023(),
      securityGroup: sg,
      role,
      userData,
      associatePublicIpAddress: true,
    });

    // デプロイ後に表示される接続コマンド
    new cdk.CfnOutput(this, 'ConnectCommand', {
      description: 'SSM で接続するコマンド',
      value: `aws ssm start-session --target ${instance.instanceId} --region ${this.region}`,
    });

    new cdk.CfnOutput(this, 'SetupLog', {
      description: 'セットアップログの確認',
      value: 'cat /var/log/atcoder-bot-setup.log',
    });
  }
}

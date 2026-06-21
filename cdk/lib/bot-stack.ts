import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

const REPO_URL = 'https://github.com/jikei334/atcoder-discord-bot.git';
const REPO_BRANCH = 'main';

export class BotStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // デフォルト VPC を使用
    const vpc = ec2.Vpc.fromLookup(this, 'DefaultVpc', { isDefault: true });

    // EBS と EC2 を VPC の最初のパブリックサブネットと同じ AZ に固定する
    const availabilityZone = vpc.publicSubnets[0].availabilityZone;

    // IAM ロール（SSM アクセス + EBS セルフアタッチ権限）
    const role = new iam.Role(this, 'BotRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
      ],
    });

    // データ永続化用 EBS ボリューム
    // RETAIN: cdk destroy してもこのボリュームは削除されない
    const dataVolume = new ec2.Volume(this, 'DataVolume', {
      availabilityZone,
      size: cdk.Size.gibibytes(20),
      volumeType: ec2.EbsDeviceVolumeType.GP3,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // EC2 が起動時に自分でボリュームをアタッチできるよう権限付与
    const volumeArn = `arn:aws:ec2:${this.region}:${this.account}:volume/${dataVolume.volumeId}`;
    role.addToPolicy(new iam.PolicyStatement({
      actions: ['ec2:AttachVolume'],
      resources: [
        volumeArn,
        `arn:aws:ec2:${this.region}:${this.account}:instance/*`,
      ],
    }));

    // セキュリティグループ（Web UI 用インバウンド 3000 のみ許可）
    const sg = new ec2.SecurityGroup(this, 'BotSg', {
      vpc,
      description: 'AtCoder Discord Bot',
      allowAllOutbound: true,
    });
    sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(3000), 'Web UI');

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

      // Docker Buildx インストール（compose build に必要）
      'mkdir -p /usr/local/lib/docker/cli-plugins',
      'BUILDX_VERSION=$(curl -fsSL https://api.github.com/repos/docker/buildx/releases/latest | grep \'"tag_name"\' | sed \'s/.*"v\\([^"]*\\)".*/\\1/\')',
      'curl -fsSL "https://github.com/docker/buildx/releases/download/v${BUILDX_VERSION}/buildx-v${BUILDX_VERSION}.linux-amd64" -o /usr/local/lib/docker/cli-plugins/docker-buildx',
      'chmod +x /usr/local/lib/docker/cli-plugins/docker-buildx',

      // リポジトリのクローン
      `git clone --branch ${REPO_BRANCH} ${REPO_URL} /opt/atcoder-bot`,

      // ── EBS ボリュームのアタッチ ──────────────────────────────────────
      // IMDSv2 でインスタンス情報を取得
      'TOKEN=$(curl -sf -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 300")',
      'INSTANCE_ID=$(curl -sf -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/instance-id)',
      'REGION=$(curl -sf -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/placement/region)',

      // EBS をセルフアタッチ（既にアタッチ済みの場合はエラーを無視）
      `aws ec2 attach-volume --volume-id ${dataVolume.volumeId} --instance-id $INSTANCE_ID --device /dev/xvdf --region $REGION || true`,

      // デバイスが OS に現れるまで待機（T3 は NVMe: /dev/nvme1n1）
      'for i in $(seq 1 60); do [ -b /dev/nvme1n1 ] && break; echo "EBS を待機中... ($i/60)"; sleep 5; done',
      '[ -b /dev/nvme1n1 ] || { echo "EBS のアタッチに失敗しました"; exit 1; }',

      // 未フォーマットなら初期化（初回のみ。2回目以降はスキップ）
      'blkid /dev/nvme1n1 || mkfs.ext4 /dev/nvme1n1',

      // postgres_data ディレクトリにマウント
      'mkdir -p /opt/atcoder-bot/postgres_data',
      'mount /dev/nvme1n1 /opt/atcoder-bot/postgres_data',

      // 再起動後も自動マウント（UUID で指定）
      'UUID=$(blkid -s UUID -o value /dev/nvme1n1)',
      'echo "UUID=$UUID /opt/atcoder-bot/postgres_data ext4 defaults,nofail 0 2" >> /etc/fstab',

      // PostgreSQL コンテナ（UID 999）用パーミッション
      'chown 999:999 /opt/atcoder-bot/postgres_data',
      // ─────────────────────────────────────────────────────────────────

      // SSM 接続ユーザーが .env を作成・編集できるよう書き込み権限を付与
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

    // EC2 インスタンス（EBS と同じ AZ に配置）
    // userDataCausesReplacement: UserData 変更時に停止→再起動ではなくインスタンス置き換えを強制する
    const instance = new ec2.Instance(this, 'BotInstance', {
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      machineImage: ec2.MachineImage.latestAmazonLinux2023(),
      securityGroup: sg,
      role,
      userData,
      associatePublicIpAddress: true,
      userDataCausesReplacement: true,
    });

    // デプロイ後に表示される情報
    new cdk.CfnOutput(this, 'ConnectCommand', {
      description: 'SSM で接続するコマンド',
      value: `aws ssm start-session --target ${instance.instanceId} --region ${this.region}`,
    });

    new cdk.CfnOutput(this, 'DataVolumeId', {
      description: 'EBS ボリューム ID（cdk destroy 後も保持されます）',
      value: dataVolume.volumeId,
    });

    new cdk.CfnOutput(this, 'SetupLog', {
      description: 'セットアップログの確認',
      value: 'cat /var/log/atcoder-bot-setup.log',
    });
  }
}

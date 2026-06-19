import * as cdk from 'aws-cdk-lib';
import { BotStack } from '../lib/bot-stack';

const app = new cdk.App();
new BotStack(app, 'AtcoderBotStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'ap-northeast-1',
  },
});

---
title: "AWS Lambda"
description: "Docker コンテナと AWS Lambda Web Adapter を使って、Mastra アプリを AWS Lambda にデプロイする方法。"
---

# AWS Lambda \{#aws-lambda\}

Docker コンテナと AWS Lambda Web Adapter を使用して、Mastra アプリケーションを AWS Lambda にデプロイします。
この方法により、Mastra サーバーを自動スケーリング対応のコンテナ化された Lambda 関数として実行できます。

:::note

このガイドでは、Mastra アプリケーションがデフォルトの
`npx create-mastra@latest` コマンドで作成されていることを前提としています。
新しい Mastra アプリケーションの作成方法の詳細は、
[はじめに](/docs/getting-started/installation)をご参照ください。

:::

## 前提条件 \{#prerequisites\}

AWS Lambda にデプロイする前に、次の準備ができていることを確認してください：

* [AWS CLI](https://aws.amazon.com/cli/) がインストールされ、設定されていること
* [Docker](https://www.docker.com/) がインストールされ、起動していること
* Lambda、ECR、IAM に対する適切な権限を持つ AWS アカウント
* 適切なメモリーストレージで構成された Mastra アプリケーション

## メモリの設定 \{#memory-configuration\}

:::note

AWS Lambda は一時的なファイルシステムを使用しており、
ファイルシステムに書き込まれたファイルは短期間で消失する可能性があります。
ファイルシステムを利用する Mastra のストレージプロバイダー（例：ファイル URL を用いる `LibSQLStore`）の使用は避けてください。

:::

Lambda 関数ではファイルシステムによる保存に制約があります。Mastra アプリケーションは、インメモリまたは外部ストレージプロバイダーを使用するように構成してください。

### オプション 1: インメモリ（最も簡単） \{#option-1-in-memory-simplest\}

```typescript filename="src/mastra/index.ts" copy showLineNumbers
import { LibSQLStore } from '@mastra/libsql';

const storage = new LibSQLStore({
  url: ':memory:', // メモリ内ストレージ
});
```

### オプション 2: 外部ストレージプロバイダー \{#option-2-external-storage-providers\}

Lambda の呼び出し間でメモリを永続化するには、Turso と組み合わせる `LibSQLStore` などの外部ストレージプロバイダー、または `PostgreStore` などの他のストレージプロバイダーを使用します。

```typescript filename="src/mastra/index.ts" copy showLineNumbers
import { LibSQLStore } from '@mastra/libsql';

const storage = new LibSQLStore({
  url: 'libsql://your-database.turso.io', // 外部Tursoデータベース
  authToken: process.env.TURSO_AUTH_TOKEN,
});
```

メモリの設定オプションの詳細は、[Memory ドキュメント](/docs/memory/overview)をご覧ください。

## Dockerfile の作成 \{#creating-a-dockerfile\}

Mastra プロジェクトのルートディレクトリに `Dockerfile` を作成します:

```dockerfile filename="Dockerfile" copy showLineNumbers
FROM node:22-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY src ./src
RUN npx mastra build
RUN apk add --no-cache gcompat

COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.0 /lambda-adapter /opt/extensions/lambda-adapter
RUN addgroup -g 1001 -S nodejs && \
  adduser -S mastra -u 1001 && \
  chown -R mastra:nodejs /app

USER mastra

ENV PORT=8080
ENV NODE_ENV=production
ENV READINESS_CHECK_PATH="/api"

EXPOSE 8080

CMD ["node", "--import=./.mastra/output/instrumentation.mjs", ".mastra/output/index.mjs"]
```

## ビルドとデプロイ \{#building-and-deploying\}

### 環境変数を設定する \{#set-up-environment-variables\}

デプロイ処理に向けて環境変数を設定します：

```bash copy
export PROJECT_NAME="your-mastra-app"
export AWS_REGION="us-east-1"
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
```

### Docker イメージを作成する \{#build-the-docker-image\}

ローカルで Docker イメージを作成します：

```bash copy
docker build -t "$PROJECT_NAME" .
```

### ECR リポジトリを作成する \{#create-an-ecr-repository\}

Docker イメージを保存するために Amazon ECR リポジトリを作成します。

```bash copy
aws ecr create-repository --repository-name "$PROJECT_NAME" --region "$AWS_REGION"
```

### Docker を ECR で認証する \{#authenticate-docker-with-ecr\}

Amazon ECR にログインします:

```bash copy
aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
```

### イメージにタグを付けてプッシュする \{#tag-and-push-the-image\}

イメージに ECR リポジトリの URI をタグ付けして、プッシュします:

```bash copy
docker tag "$PROJECT_NAME":latest "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$PROJECT_NAME":latest
docker push "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$PROJECT_NAME":latest
```

### Lambda 関数を作成する \{#create-the-lambda-function\}

AWS コンソールを使用して Lambda 関数を作成します:

1. [AWS Lambda コンソール](https://console.aws.amazon.com/lambda/) に移動します
2. **Create function** をクリックします
3. **Container image** を選択します
4. 関数を構成します:
   * **Function name**: 任意の関数名（例: `mastra-app`）
   * **Container image URI**: **Browse images** をクリックし、ECR リポジトリを選択してから `latest` タグを選びます
   * **Architecture**: Docker ビルドに対応するアーキテクチャを選択します（通常は `x86_64`）

### Function URL を設定する \{#configure-function-url\}

外部からのアクセスを許可するために Function URL を有効化します:

1. Lambda 関数の設定で **Configuration** &gt; **Function URL** に移動
2. **Create function URL** をクリック
3. **Auth type** を **NONE**（公開アクセス）に設定
4. **CORS** を設定:
   * **Allow-Origin**: `*`（本番環境では自社ドメインに制限）
   * **Allow-Headers**: `content-type`
   * **Allow-Methods**: `*`（本番環境では精査のうえ制限）
5. **Save** をクリック

### 環境変数を設定する \{#configure-environment-variables\}

Lambda 関数の設定で環境変数を追加します:

1. **Configuration** &gt; **Environment variables** に移動します
2. Mastra アプリケーションに必要な変数を追加します:
   * `OPENAI_API_KEY`:（OpenAI を使用する場合）OpenAI の API キー
   * `ANTHROPIC_API_KEY`:（Anthropic を使用する場合）Anthropic の API キー
   * `TURSO_AUTH_TOKEN`:（Turso と LibSQL を使用する場合）Turso の認証トークン
   * 必要に応じて、その他のプロバイダー固有の API キー

### 関数設定を調整する \{#adjust-function-settings\}

関数のメモリとタイムアウトを設定します：

1. **Configuration** &gt; **General configuration** に移動します
2. 次の推奨値を設定します：
   * **Memory**: 512 MB（アプリケーションの要件に応じて調整）
   * **Timeout**: 30秒（アプリケーションの要件に応じて調整）
   * **Ephemeral storage**: 512 MB（任意。一時ファイル用）

## デプロイをテストする \{#testing-your-deployment\}

デプロイが完了したら、Lambda 関数をテストします。

1. Lambda コンソールで **Function URL** をコピーします
2. ブラウザでその URL を開き、Mastra サーバーのホーム画面を確認します
3. 生成された API エンドポイントを使って、エージェントやワークフローをテストします

利用可能な API エンドポイントの詳細は、[サーバーのドキュメント](/docs/deployment/server-deployment)をご覧ください。

## クライアントの接続 \{#connecting-your-client\}

クライアントアプリケーションを更新し、Lambda 関数の URL を使用するようにしてください:

```typescript filename="src/client.ts" copy showLineNumbers
import { MastraClient } from '@mastra/client-js';

const mastraClient = new MastraClient({
  baseUrl: 'https://your-function-url.lambda-url.us-east-1.on.aws',
});
```

## トラブルシューティング \{#troubleshooting\}

### 関数のタイムアウトエラー \{#function-timeout-errors\}

Lambda 関数がタイムアウトする場合は、次の対処を検討してください。

* **Configuration** &gt; **General configuration** でタイムアウト値を引き上げる
* Mastra アプリケーションを最適化してコールドスタートを短縮する
* パフォーマンスを安定させるためにプロビジョンド同時実行を利用することを検討する

### メモリに関する問題 \{#memory-issues\}

メモリ関連のエラーが発生した場合は、次の対応を行ってください:

* **Configuration** &gt; **General configuration** でメモリの割り当てを増やす
* CloudWatch Logs でメモリ使用量を監視する
* アプリケーションのメモリ使用量を最適化する

### CORS の問題 \{#cors-issues\}

ホームページでは問題ないが、エンドポイントにアクセスすると CORS エラーが発生する場合:

* Mastra サーバーの設定で CORS ヘッダーが正しく構成されていることを確認する
* Lambda Function URL の CORS 設定を確認する
* クライアントが正しい URL にリクエストしていることを確認する

### コンテナイメージに関する問題 \{#container-image-issues\}

Lambda 関数が起動しない場合は、次を確認してください:

* Docker イメージをローカルで問題なくビルドできること
* Dockerfile の `CMD` 命令が正しいこと
* コンテナの起動エラーについて CloudWatch Logs を確認すること
* コンテナ内に Lambda Web Adapter が正しくインストールされていること

## 本番環境での考慮事項 \{#production-considerations\}

本番環境へのデプロイ時は、次の点に注意してください:

### セキュリティ \{#security\}

* CORS の許可元は信頼できるドメインに限定する
* 他の AWS サービスへ安全にアクセスするために AWS IAM ロールを使用する
* 機密性の高い環境変数は AWS Secrets Manager または Parameter Store に保存する

### 監視 \{#monitoring\}

* Lambda 関数の CloudWatch 監視を有効化する
* エラーやパフォーマンスメトリクス向けの CloudWatch アラームを設定する
* 分散トレーシングには AWS X-Ray を利用する

### スケーリング \{#scaling\}

* 予測可能なパフォーマンスのためにプロビジョンドコンカレンシーを設定する
* 同時実行数を監視し、必要に応じて上限を調整する
* より複雑なルーティングが必要な場合は、Application Load Balancer の利用を検討する

## 次のステップ \{#next-steps\}

* [Mastra Client SDK](/docs/server-db/mastra-client)
* [AWS Lambda ドキュメント](https://docs.aws.amazon.com/lambda/)
* [AWS Lambda Web Adapter](https://github.com/awslabs/aws-lambda-web-adapter)
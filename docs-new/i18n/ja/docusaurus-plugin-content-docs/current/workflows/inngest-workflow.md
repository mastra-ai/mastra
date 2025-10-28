---
title: "Inngest ワークフロー"
description: "Inngest のワークフローで Mastra のワークフローを実行できます"
sidebar_position: 9
---

# Inngest ワークフロー \{#inngest-workflow\}

[Inngest](https://www.inngest.com/docs) は、インフラの運用を気にせずにバックグラウンドワークフローを構築・実行できる、開発者向けプラットフォームです。

## Inngest と Mastra の連携方法 \{#how-inngest-works-with-mastra\}

Inngest と Mastra は、それぞれのワークフロー・モデルを揃えることで統合されます。Inngest はロジックをステップで構成された関数として整理し、Mastra のワークフローは `createWorkflow` と `createStep` で定義され、このモデルにそのまま対応します。各 Mastra ワークフローは一意の識別子を持つ Inngest の関数となり、ワークフロー内の各ステップは Inngest のステップに対応します。

`serve` 関数は、Mastra のワークフローを Inngest の関数として登録し、実行とモニタリングに必要なイベント・ハンドラーを設定することで、両システムを橋渡しします。

イベントでワークフローが起動されると、Inngest はステップごとに実行し、各ステップの結果をメモ化します。これにより、ワークフローがリトライや再開された際には、完了済みのステップをスキップでき、効率的で信頼性の高い実行が実現します。Mastra のループ、条件分岐、ネストされたワークフローといった制御フローのプリミティブは、Inngest の同じ関数/ステップ・モデルへシームレスに変換され、合成、分岐、一時停止といった高度なワークフロー機能が維持されます。

リアルタイムのモニタリング、一時停止/再開、ステップ単位の可観測性は、Inngest の publish-subscribe システムとダッシュボードによって実現されます。各ステップの実行時には、その状態と出力が Mastra のストレージで追跡され、必要に応じて再開できます。

## セットアップ \{#setup\}

```sh
npm install @mastra/inngest @mastra/core @mastra/deployer
```

## Inngest ワークフローの構築 \{#building-an-inngest-workflow\}

このガイドでは、Inngest と Mastra を用いてワークフローを作成する方法を紹介し、値が 10 に達するまでカウントアップするカウンターアプリの例で解説します。

### Inngest の初期化 \{#inngest-initialization\}

Inngest の連携を初期化して、Mastra と互換性のあるワークフロー用ヘルパーを取得します。createWorkflow と createStep 関数は、Mastra および Inngest と互換性のあるワークフローおよびステップのオブジェクトを作成するために使用します。

開発中

```ts showLineNumbers copy filename="src/mastra/inngest/index.ts"
import { Inngest } from 'inngest';
import { realtimeMiddleware } from '@inngest/realtime';

export const inngest = new Inngest({
  id: 'mastra',
  baseUrl: 'http://localhost:8288',
  isDev: true,
  middleware: [realtimeMiddleware()],
});
```

本番環境

```ts showLineNumbers copy filename="src/mastra/inngest/index.ts"
import { Inngest } from 'inngest';
import { realtimeMiddleware } from '@inngest/realtime';

export const inngest = new Inngest({
  id: 'mastra',
  middleware: [realtimeMiddleware()],
});
```

### ステップの作成 \{#creating-steps\}

ワークフローを構成する各ステップを定義します。

```ts showLineNumbers copy filename="src/mastra/workflows/index.ts"
import { z } from 'zod';
import { inngest } from '../inngest';
import { init } from '@mastra/inngest';

// MastraでInngestを初期化し、ローカルのInngestサーバーを指定
const { createWorkflow, createStep } = init(inngest);

// ステップ: カウンター値をインクリメント
const incrementStep = createStep({
  id: 'increment',
  inputSchema: z.object({
    value: z.number(),
  }),
  outputSchema: z.object({
    value: z.number(),
  }),
  execute: async ({ inputData }) => {
    return { value: inputData.value + 1 };
  },
});
```

### ワークフローの作成 \{#creating-the-workflow\}

`dountil` ループパターンを使って手順をワークフローにまとめます。createWorkflow 関数は、inngest サーバー上で呼び出し可能な関数を作成します。

```ts showLineNumbers copy filename="src/mastra/workflows/index.ts"
// inngest サーバーに関数として登録されるワークフロー
const workflow = createWorkflow({
  id: 'increment-workflow',
  inputSchema: z.object({
    value: z.number(),
  }),
  outputSchema: z.object({
    value: z.number(),
  }),
}).then(incrementStep);

workflow.commit();

export { workflow as incrementWorkflow };
```

### Mastra インスタンスの設定とワークフローの実行 \{#configuring-the-mastra-instance-and-executing-the-workflow\}

ワークフローを Mastra に登録し、Inngest の API エンドポイントを設定します:

```ts showLineNumbers copy filename="src/mastra/index.ts"
import { Mastra } from '@mastra/core/mastra';
import { serve as inngestServe } from '@mastra/inngest';
import { incrementWorkflow } from './workflows';
import { inngest } from './inngest';
import { PinoLogger } from '@mastra/loggers';

// ワークフローとInngest APIエンドポイントでMastraを設定
export const mastra = new Mastra({
  workflows: {
    incrementWorkflow,
  },
  server: {
    // ローカルのDockerコンテナがMastraサーバーに接続できるようにするため、サーバー設定が必要です
    host: '0.0.0.0',
    apiRoutes: [
      // このAPIルートは、Mastraワークフロー(Inngest関数)をInngestサーバーに登録するために使用されます
      {
        path: '/api/inngest',
        method: 'ALL',
        createHandler: async ({ mastra }) => inngestServe({ mastra, inngest }),
        // inngestServe関数は、次の方法でMastraワークフローをInngestと統合します:
        // 1. 各ワークフローに対して一意のID(workflow.${workflowId})を持つInngest関数を作成
        // 2. 次の処理を行うイベントハンドラーを設定:
        //    - 各ワークフロー実行に対して一意の実行IDを生成
        //    - ステップ実行を管理するInngestExecutionEngineを作成
        //    - ワークフロー状態の永続化とリアルタイム更新を処理
        // 3. workflow:${workflowId}:${runId}チャネルを通じて
        //    リアルタイム監視用のパブリッシュ・サブスクライブシステムを確立
        //
        // オプション: ワークフローと並行して提供する追加のInngest関数を渡すこともできます:
        // createHandler: async ({ mastra }) => inngestServe({
        //   mastra,
        //   inngest,
        //   functions: [customFunction1, customFunction2] // ユーザー定義のInngest関数
        // }),
      },
    ],
  },
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
```

### ワークフローをローカルで実行する \{#running-the-workflow-locally\}

> **前提条件:**
>
> * Docker がインストールされ、起動していること
> * Mastra プロジェクトがセットアップ済み
> * 依存関係がインストール済み（`npm install`）

1. `npx mastra dev` を実行して、ローカルで Mastra サーバーを起動します（ポート 4111 で待ち受け）。
2. Inngest Dev Server を起動する（Docker 経由）
   新しいターミナルで次を実行します:

```sh
docker run --rm -p 8288:8288 \
  inngest/inngest \
  inngest dev -u http://host.docker.internal:4111/api/inngest
```

> **注意:** `-u` の後ろの URL は、Inngest の開発サーバーに Mastra の `/api/inngest` エンドポイントの場所を指定します。

3. Inngest ダッシュボードを開く

* ブラウザで [http://localhost:8288](http://localhost:8288) にアクセスします。
* サイドバーの **Apps** セクションに移動します。
* Mastra のワークフローが登録されているはずです。

4. ワークフローを実行する

* サイドバーの **Functions** セクションに移動します。
* Mastra のワークフローを選択します。
* **Invoke** をクリックし、次の入力を使用します。

```json
{
  "data": {
    "inputData": {
      "value": 5
    }
  }
}
```

5. **ワークフローの実行をモニタリングする**

* サイドバーの **Runs** タブに移動します。
* 最新の実行をクリックして、各ステップの進行状況を確認します。

### 本番環境でワークフローを実行する \{#running-the-workflow-in-production\}

> **前提条件:**
>
> * Vercel アカウントと Vercel CLI がインストールされていること（`npm i -g vercel`）
> * Inngest アカウント
> * Vercel トークン（推奨: 環境変数として設定）

1. Mastra インスタンスに Vercel Deployer を追加する

```ts showLineNumbers copy filename="src/mastra/index.ts"
import { VercelDeployer } from '@mastra/deployer-vercel';

export const mastra = new Mastra({
  // ...その他の設定
  deployer: new VercelDeployer({
    teamSlug: 'your_team_slug',
    projectName: 'your_project_name',
    // Vercelトークンは、Vercelダッシュボードの右上にあるユーザーアイコンをクリックし、
    // 「アカウント設定」をクリックした後、左サイドバーの「トークン」をクリックすることで取得できます。
    token: 'your_vercel_token',
  }),
});
```

> **注意:** 環境変数に Vercel トークンを設定します:
>
> ```sh
> export VERCEL_TOKEN=your_vercel_token
> ```

2. mastra インスタンスをビルドする

```sh
npx mastra build
```

3. Vercel へデプロイする

```sh
cd .mastra/output
vercel --prod
```

> **Tip:** まだの場合は、`vercel login` を実行して Vercel CLI にログインしてください。

4. Inngest ダッシュボードと同期する

* [Inngest ダッシュボード](https://app.inngest.com/env/production/apps) に移動します。
* **Sync new app with Vercel** をクリックし、手順に従います。
* Mastra のワークフローがアプリとして登録されていることを確認します。

5. ワークフローを実行する

* **Functions** セクションで、`workflow.increment-workflow` を選択します。
* 右上の **All actions** &gt; **Invoke** をクリックします。
* 次の入力を指定します：

```json
{
  "data": {
    "inputData": {
      "value": 5
    }
  }
}
```

6. 実行の監視

* **Runs** タブに移動します。
* 最新の Run をクリックして、各ステップの進行状況を確認します。

## 上級編: カスタム Inngest 関数の追加 \{#advanced-usage-adding-custom-inngest-functions\}

`inngestServe` のオプション引数 `functions` を使うと、Mastra のワークフローと並行して追加の Inngest 関数を提供できます。

### カスタム関数の作成 \{#creating-custom-functions\}

まず、独自の Inngest 関数を作成します：

```ts showLineNumbers copy filename="src/inngest/custom-functions.ts"
import { inngest } from './inngest';

// カスタムInngest関数を定義
export const customEmailFunction = inngest.createFunction(
  { id: 'send-welcome-email' },
  { event: 'user/registered' },
  async ({ event }) => {
    // カスタムメールロジックをここに記述
    console.log(`ウェルカムメールを送信: ${event.data.email}`);
    return { status: 'email_sent' };
  },
);

export const customWebhookFunction = inngest.createFunction(
  { id: 'process-webhook' },
  { event: 'webhook/received' },
  async ({ event }) => {
    // カスタムWebhook処理
    console.log(`Webhook処理: ${event.data.type}`);
    return { processed: true };
  },
);
```

### ワークフローでカスタム関数を提供する \{#serving-custom-functions-with-workflows\}

Mastra の設定を更新し、カスタム関数を組み込みます:

```ts showLineNumbers copy filename="src/mastra/index.ts"
import { Mastra } from '@mastra/core/mastra';
import { serve as inngestServe } from '@mastra/inngest';
import { incrementWorkflow } from './workflows';
import { inngest } from './inngest';
import { customEmailFunction, customWebhookFunction } from './inngest/custom-functions';

export const mastra = new Mastra({
  workflows: {
    incrementWorkflow,
  },
  server: {
    host: '0.0.0.0',
    apiRoutes: [
      {
        path: '/api/inngest',
        method: 'ALL',
        createHandler: async ({ mastra }) =>
          inngestServe({
            mastra,
            inngest,
            functions: [customEmailFunction, customWebhookFunction], // カスタム関数を追加する
          }),
      },
    ],
  },
});
```

### 関数の登録 \{#function-registration\}

カスタム関数を含める場合:

1. **Mastra のワークフロー**は、自動的に `workflow.${workflowId}` のような ID を持つ Inngest 関数に変換されます
2. **カスタム関数**は、指定した ID（例: `send-welcome-email`、`process-webhook`）をそのまま維持します
3. **すべての関数**は同じ `/api/inngest` エンドポイントでまとめて提供されます

これにより、Mastra のワークフローオーケストレーションを既存の Inngest 関数とシームレスに統合できます。
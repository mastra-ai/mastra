---
title: "インストール"
description: Mastra のインストールと、各種 LLM プロバイダーで実行するために必要な前提条件のセットアップ手順を解説します。
sidebar_position: 1
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';
import { VideoPlayer } from '@site/src/components/video-player';

# Mastra をインストール \{#install-mastra\}

`create mastra` CLI コマンドは、新規の Mastra プロジェクトを始める最も手早い方法です。セットアップを案内し、学習やカスタマイズに使えるサンプルのエージェント、ワークフロー、ツールを作成します。

セットアップをより細かく制御したい場合や、既存プロジェクトに Mastra を追加したい場合は、[手動インストールガイド](#install-manually) を参照してください。既存プロジェクトには [`mastra init`](/docs/reference/cli/mastra#mastra-init) も利用できます。

## 始める前に \{#before-you-start\}

* セットアップを完了するには、[モデルプロバイダー](/docs/models)の API キーが必要です。まずは [OpenAI](https://platform.openai.com/api-keys) をおすすめしますが、クレジットカード不要のプロバイダーが必要な場合は、Google の [Gemini](https://aistudio.google.com/app/api-keys) も選択肢です。
* Node.js 20 以降を[インストール](https://nodejs.org/en/download)してください。

## `create mastra` でインストール \{#install-with-create-mastra\}

`create mastra` は、マシン上のどこからでも実行できます。

セットアップウィザードが案内し、プロジェクト用の新しいディレクトリを作成して、はじめに役立つサンプルのワークフローとツールを備えた天気エージェントを生成します。

<Tabs>
  <TabItem value="npm" label="npm" default>
    ```bash copy
    npm create mastra@latest -y
    ```
  </TabItem>

  <TabItem value="pnpm" label="pnpm">
    ```bash copy
    pnpm create mastra@latest -y
    ```
  </TabItem>

  <TabItem value="yarn" label="yarn">
    ```bash copy
    yarn create mastra@latest -y
    ```
  </TabItem>

  <TabItem value="bun" label="bun">
    ```bash copy
    bun create mastra@latest -y
    ```
  </TabItem>
</Tabs>

:::note
`create mastra` では、`--no-example` のようなフラグでサンプルの天気エージェントをスキップしたり、`--template` で特定の[テンプレート](/docs/getting-started/templates)から始めたりできます。すべてのオプションは [CLI リファレンス](/docs/reference/cli/create-mastra)をご覧ください。
:::

### エージェントをテストする \{#test-your-agent\}

セットアップが完了したら、ターミナルの指示に従って Mastra の開発サーバーを起動し、`http://localhost:4111` で Playground を開きます。

天気について質問してみてください。API キーが正しく設定されていれば、返答が表示されます。

<VideoPlayer src="https://res.cloudinary.com/mastra-assets/video/upload/v1751406022/local-dev-agents-playground_100_m3begx.mp4" />

:::note
エラーが発生した場合は、API キーが正しく設定されていない可能性があります。セットアップを再確認して、もう一度お試しください。さらにサポートが必要ですか？[Discord に参加](https://discord.gg/BTYqqHKUrf)して、チームに直接ご相談ください。
:::

[Playground](/docs/getting-started/local-dev-playground) を使うと、UI を作らずにエージェントをすばやく構築・試作できます。準備が整ったら、以下のガイドに従って Mastra エージェントをアプリケーションに統合してください。

### 次のステップ \{#next-steps\}

* [Mastra の機能](/docs#why-mastra)について詳しく読む
* お使いのフロントエンドフレームワークに Mastra を統合する: [Next.js](/docs/frameworks/web-frameworks/next-js)、[React](/docs/frameworks/web-frameworks/vite-react)、または [Astro](/docs/frameworks/web-frameworks/astro)
* [ガイド](/docs/guides)のいずれかに沿って、ゼロからエージェントを構築する
* [YouTube チャンネル](https://www.youtube.com/@mastra-ai)でコンセプトガイドを視聴し、[チャンネル登録](https://www.youtube.com/@mastra-ai?sub_confirmation=1)しよう！

## 手動でインストール \{#install-manually\}

自動の `create mastra` CLI ツールを使用したくない場合は、以下のガイドに従ってご自身でプロジェクトをセットアップできます。

### プロジェクトの作成 \{#create-project\}

新しいプロジェクトを作成し、ディレクトリを移動します：

```bash copy
mkdir my-first-agent && cd my-first-agent
```

TypeScript プロジェクトを初期化し、次の依存関係をインストールします。

<Tabs>
  <TabItem value="npm" label="npm" default>
    ```bash copy
    npm init -y
    npm install -D typescript @types/node mastra@latest
    npm install @mastra/core@latest zod@^4
    ```
  </TabItem>

  <TabItem value="pnpm" label="pnpm">
    ```bash copy
    pnpm init -y
    pnpm add -D typescript @types/node mastra@latest
    pnpm add @mastra/core@latest zod@^4
    ```
  </TabItem>

  <TabItem value="yarn" label="yarn">
    ```bash copy
    yarn init -y
    yarn add -D typescript @types/node mastra@latest
    yarn add @mastra/core@latest zod@^4
    ```
  </TabItem>

  <TabItem value="bun" label="bun">
    ```bash copy
    bun init -y
    bun add -d typescript @types/node mastra@latest
    bun add @mastra/core@latest zod@^4
    ```
  </TabItem>
</Tabs>

package.json に dev と build のスクリプトを追加します。

```json filename="package.json" copy /,/ /"dev": "mastra dev",/ /"build": "mastra build"/
{
  "scripts": {
    "test": "echo \"エラー: テストが指定されていません\" && exit 1",
    "dev": "mastra dev",
    "build": "mastra build"
  }
}
```

### TypeScript を初期化する \{#initialize-typescript\}

`tsconfig.json` ファイルを作成します:

```bash copy
touch tsconfig.json
```

次の設定を追加してください：

```json filename="tsconfig.json" copy
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "outDir": "dist"
  },
  "include": ["src/**/*"]
}
```

:::note
Mastra を使用するには、`module` と `moduleResolution` をモダンな設定にする必要があります。`CommonJS` や `node` を使用すると、解決時のエラーが発生します。
:::

### API キーの設定 \{#set-api-key\}

`.env` ファイルを作成します：

```bash copy
touch .env
```

API キーを追加:

```bash filename=".env" copy
GOOGLE_GENERATIVE_AI_API_KEY=<your-api-key>
```

:::note
このガイドでは Google Gemini を使用していますが、OpenAI や Anthropic など、サポートされている任意の[モデルプロバイダー](/docs/models)を使用できます。
:::

### ツールを追加 \{#add-tool\}

`weather-tool.ts` ファイルを作成します：

```bash copy
mkdir -p src/mastra/tools && touch src/mastra/tools/weather-tool.ts
```

次のコードを追加してください：

```ts filename="src/mastra/tools/weather-tool.ts" showLineNumbers copy
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const weatherTool = createTool({
  id: 'get-weather',
  description: '指定した場所の現在の天気を取得する',
  inputSchema: z.object({
    location: z.string().describe('市区町村名'),
  }),
  outputSchema: z.object({
    output: z.string(),
  }),
  execute: async () => {
    return {
      output: '天気は晴れです',
    };
  },
});
```

:::note
ここでは `weatherTool` の例を短く簡潔にしています。完全版のツールは [Giving an Agent a Tool](/docs/examples/agents/using-a-tool) をご覧ください。
:::

### エージェントを追加 \{#add-agent\}

`weather-agent.ts` ファイルを作成します：

```bash copy
mkdir -p src/mastra/agents && touch src/mastra/agents/weather-agent.ts
```

次のコードを追加してください：

```ts filename="src/mastra/agents/weather-agent.ts" showLineNumbers copy
import { Agent } from '@mastra/core/agent';
import { weatherTool } from '../tools/weather-tool';

export const weatherAgent = new Agent({
  name: 'Weather Agent',
  instructions: `
      あなたは正確な気象情報を提供する親切な天気アシスタントです。

      あなたの主な役割は、ユーザーが特定の場所の天気情報を取得できるよう支援することです。応答する際は以下に従ってください:
      - 場所が指定されていない場合は、必ず場所を尋ねてください
      - 場所の名前が英語でない場合は、英語に翻訳してください
      - 複数の部分で構成される場所を指定する場合(例:「New York, NY」)、最も関連性の高い部分を使用してください(例:「New York」)
      - 湿度、風の状況、降水量などの関連情報を含めてください
      - 応答は簡潔かつ有益なものにしてください

      現在の気象データの取得にはweatherToolを使用してください。
`,
  model: 'google/gemini-2.5-pro',
  tools: { weatherTool },
});
```

### エージェントの登録 \{#register-agent\}

Mastra のエントリポイントを作成し、エージェントを登録します。

```bash copy
touch src/mastra/index.ts
```

次のコードを追加してください：

```ts filename="src/mastra/index.ts" showLineNumbers copy
import { Mastra } from '@mastra/core/mastra';
import { weatherAgent } from './agents/weather-agent';

export const mastra = new Mastra({
  agents: { weatherAgent },
});
```

### エージェントをテストする \{#test-your-agent\}

[Playground](/docs/getting-started/local-dev-playground) を起動して、エージェントをテストしましょう。

<Tabs>
  <TabItem value="npm" label="npm" default>
    ```bash copy
    npm run dev
    ```
  </TabItem>

  <TabItem value="pnpm" label="pnpm">
    ```bash copy
    pnpm run dev
    ```
  </TabItem>

  <TabItem value="yarn" label="yarn">
    ```bash copy
    yarn run dev
    ```
  </TabItem>

  <TabItem value="bun" label="bun">
    ```bash copy
    bun run dev
    ```
  </TabItem>
</Tabs>
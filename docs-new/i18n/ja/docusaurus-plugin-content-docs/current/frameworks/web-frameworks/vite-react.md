---
title: "Vite／React の統合"
description: Vite と React に Mastra を統合するためのステップバイステップガイド。
sidebar_position: 1
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Vite/React プロジェクトに Mastra を統合する \{#integrate-mastra-in-your-vitereact-project\}

Mastra は Vite と統合されており、次のことが簡単に行えます:

* 柔軟な API を構築して AI 搭載機能を提供する
* フロントエンドとバックエンドを単一のコードベースにまとめ、デプロイを容易にする
* Mastra のクライアント SDK を活用する

このガイドに従って、Vite/React プロジェクトに Mastra をスキャフォールドし、統合しましょう。

:::warning

このガイドは、プロジェクトのルート (例: `app`) で React Router v7 を使用する Vite/React を前提としています。

:::

## Mastra のインストール \{#install-mastra\}

必要な Mastra パッケージをインストールします:

<Tabs>
  <TabItem value="install" label="install">
    `bash copy
        npm install mastra@latest @mastra/core@latest @mastra/libsql@latest @mastra/client-js@latest
        `
  </TabItem>

  <TabItem value="tab-2" label="Tab 2">
    `bash copy
        yarn add mastra@latest @mastra/core@latest @mastra/libsql@latest @mastra/client-js@latest
        `
  </TabItem>

  <TabItem value="tab-3" label="Tab 3">
    `bash copy
        pnpm add mastra@latest @mastra/core@latest @mastra/libsql@latest @mastra/client-js@latest
        `
  </TabItem>

  <TabItem value="tab-4" label="Tab 4">
    `bash copy
        bun add mastra@latest @mastra/core@latest @mastra/libsql@latest @mastra/client-js@latest
        `
  </TabItem>
</Tabs>

## Mastra を統合する \{#integrate-mastra\}

プロジェクトに Mastra を組み込むには、次の2つの方法があります。

### 1. ワンライナーを使う \{#1-use-the-one-liner\}

次のコマンドを実行して、適切な既定値で Weather エージェントのテンプレートを素早く作成します:

```bash copy
npx mastra@latest init --dir . --components agents,tools --example --llm openai
```

> 詳細は [mastra init](/docs/reference/cli/mastra#mastra-init) を参照してください。

### 2. 対話型 CLI を使う \{#2-use-the-interactive-cli\}

セットアップをカスタマイズしたい場合は、`init` コマンドを実行し、表示されるプロンプトに従ってオプションを選択してください:

```bash copy
npx mastra@latest init
```

:::warning

デフォルトでは、`mastra init` はインストール先として `src` を提案します。プロジェクト直下で Vite/React を使っている場合（例：`app`。`src/app` ではない）、プロンプトが表示されたら `.` を入力してください。

:::

`package.json` に `dev` と `build` のスクリプトを追加します。

<Tabs>
  <TabItem value="root-mastra" label="mastra/ directory" default>
    ```json filename="package.json"
    {
      "scripts": {
        ...
        "dev:mastra": "mastra dev --dir mastra",
        "build:mastra": "mastra build --dir mastra"
      }
    }
    ```
  </TabItem>

  <TabItem value="src-mastra" label="src/mastra/ directory">
    ```json filename="package.json"
    {
      "scripts": {
        ...
        "dev:mastra": "mastra dev --dir src/mastra",
        "build:mastra": "mastra build --dir src/mastra"
      }
    }
    ```
  </TabItem>
</Tabs>

## TypeScript を設定する \{#configure-typescript\}

プロジェクトのルートにある `tsconfig.json` ファイルを編集します:

```json filename="tsconfig.json"
{
  ...
  "exclude": ["dist", ".mastra"]
}
```

## API キーの設定 \{#set-up-api-keys\}

```bash filename=".env" copy
OPENAI_API_KEY=<your-api-key>
```

> 各LLMプロバイダーは異なる環境変数を使用します。詳しくは[モデルの機能](/docs/models)をご覧ください。

## .gitignore を更新する \{#update-gitignore\}

`.gitignore` ファイルに `.mastra` を追加します：

```bash filename=".gitignore" copy
.mastra
```

## Mastra Dev Server を起動する \{#start-the-mastra-dev-server\}

Mastra Dev Server を起動して、エージェントを REST エンドポイントとして公開します。

<Tabs>
  <TabItem value="tab-1" label="Tab 1">
    ```bash copy
    npm run dev:mastra
    ```
  </TabItem>

  <TabItem value="tab-2" label="Tab 2">
    ```bash copy
    mastra dev:mastra
    ```
  </TabItem>
</Tabs>

> 起動すると、エージェントはローカル環境で利用可能になります。詳しくは「[ローカル開発環境](/docs/getting-started/local-dev-playground)」をご覧ください。

## Vite 開発サーバーを起動する \{#start-vite-dev-server\}

Mastra Dev Server が起動していれば、通常どおり Vite アプリを起動できます。

## Mastra クライアントを作成する \{#create-mastra-client\}

新しいディレクトリとファイルを作成し、次のサンプルコードを追加します：

```bash copy
mkdir lib
touch lib/mastra.ts
```

```typescript filename="lib/mastra.ts" showLineNumbers copy
import { MastraClient } from '@mastra/client-js';

export const mastraClient = new MastraClient({
  baseUrl: import.meta.env.VITE_MASTRA_API_URL || 'http://localhost:4111',
});
```

## テスト用のルート設定を作成する \{#create-test-route-config\}

設定に新しい `route` を追加します：

```typescript filename="app/routes.ts" showLineNumbers copy
import { type RouteConfig, index, route } from '@react-router/dev/routes';

export default [index('routes/home.tsx'), route('test', 'routes/test.tsx')] satisfies RouteConfig;
```

## テストルートを作成する \{#create-test-route\}

新しいルートを作成し、以下のサンプルコードを追加します:

```bash copy
touch app/routes/test.tsx
```

```typescript filename="app/routes/test.tsx" showLineNumbers copy
import { useState } from "react";
import { mastraClient } from "../../lib/mastra";

export default function Test() {
  const [result, setResult] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const city = formData.get("city")?.toString();
    const agent = mastraClient.getAgent("weatherAgent");

    const response = await agent.generate({
      messages: [{ role: "user", content: `${city}の天気はどうですか？` }]
    });

    setResult(response.text);
  }

  return (
    <>
      <h1>テスト</h1>
      <form onSubmit={handleSubmit}>
        <input name="city" placeholder="都市名を入力してください" required />
        <button type="submit">天気を確認</button>
      </form>
      {result && <pre>{result}</pre>}
    </>
  );
}
```

> これでブラウザで `/test` にアクセスして試せます。

都市に **London** を入力して送信すると、次のような結果が返ってきます：

```plaintext
ロンドンの現在の天気は晴れ時々曇り、気温19.3°C、体感17.4°Cです。湿度53%、風速15.9km/h、最大瞬間風速38.5km/hです。
```

## 次の手順 \{#next-steps\}

* [Monorepo のデプロイ](/docs/deployment/monorepo)
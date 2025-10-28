---
title: "Astro と一緒に"
description: Mastra を Astro に統合するためのステップバイステップガイド。
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Astro プロジェクトに Mastra を統合する \{#integrate-mastra-in-your-astro-project\}

Mastra は Astro と統合されており、次のことが簡単に行えます:

* 柔軟な API を構築して、AI 搭載の機能を提供する
* フロントエンドとバックエンドを単一のコードベースにまとめて、デプロイを簡素化する
* Astro の組み込みの [Actions](https://docs.astro.build/en/guides/actions/) や [Server Endpoints](https://docs.astro.build/en/guides/endpoints/#server-endpoints-api-routes) を活用して、効率的なサーバーとクライアントのワークフローを実現する

このガイドを使って、Astro プロジェクトへの Mastra のスキャフォールド作成と統合を行いましょう。

<Tabs>
  <TabItem value="mastra のインストール" label="Mastra をインストール">
    :::warning

    このガイドは、ReactおよびVercelアダプターでAstroのActionsを使用していることを前提としています。

    :::

    ## Mastraのインストール \{#install-mastra\}

    必要なMastraパッケージをインストールする:

    <Tabs>
      <TabItem value="install" label="インストール">
        ```bash copy
        npm install mastra@latest @mastra/core@latest @mastra/libsql@latest
        ```
      </TabItem>

      <TabItem value="tab-3" label="タブ3">
        ```bash copy
        yarn add mastra@latest @mastra/core@latest @mastra/libsql@latest
        ```
      </TabItem>

      <TabItem value="tab-4" label="タブ4">
        ```bash copy
        pnpm add mastra@latest @mastra/core@latest @mastra/libsql@latest
        ```
      </TabItem>

      <TabItem value="tab-5" label="タブ5">
        ```bash copy
        bun add mastra@latest @mastra/core@latest @mastra/libsql@latest
        ```
      </TabItem>
    </Tabs>

    ## Mastraの統合 \{#integrate-mastra\}

    Mastraをプロジェクトに統合するには、2つのオプションがあります:

    ### 1. ワンライナーを使用する \{#1-use-the-one-liner\}

    以下のコマンドを実行して、適切なデフォルト設定を持つWeatherエージェントを素早く構築します:

    ```bash copy
    npx mastra@latest init --default
    ```

    > 詳細は [mastra init](/docs/reference/cli/mastra#mastra-init) をご参照ください。

    ### 2. インタラクティブCLIを使用する \{#2-use-the-interactive-cli\}

    セットアップをカスタマイズする場合は、`init`コマンドを実行し、プロンプトが表示されたら選択肢から選んでください:

    ```bash copy
    npx mastra@latest init
    ```

    `package.json`に`dev`と`build`スクリプトを追加します:

    ```json filename="package.json"
    {
      "scripts": {
        ...
        "dev:mastra": "mastra dev",
        "build:mastra": "mastra build"
      }
    }
    ```

    ## TypeScriptを設定する \{#configure-typescript\}

    プロジェクトルートの `tsconfig.json` ファイルを変更します:

    ```json filename="tsconfig.json"
    {
      ...
      "exclude": ["dist", ".mastra"]
    }
    ```

    ## APIキーの設定 \{#set-up-api-key\}

    ```bash filename=".env" copy
    OPENAI_API_KEY=<your-api-key>
    ```

    ## .gitignore を更新する \{#update-gitignore\}

    `.mastra` と `.vercel` を `.gitignore` ファイルに追加します:

    ```bash filename=".gitignore" copy
    .mastra
    .vercel
    ```

    ## Mastraエージェントを更新する \{#update-the-mastra-agent\}

    Astroは`process.env`ではなく`import.meta.env`を介して環境変数にアクセスするViteを使用しています。そのため、モデルコンストラクタは次のようにVite環境から`apiKey`を明示的に受け取る必要があります:

    ```diff filename="src/mastra/agents/weather-agent.ts"
    - import { openai } from "@ai-sdk/openai";
    + import { createOpenAI } from "@ai-sdk/openai";

    + const openai = createOpenAI({
    +   apiKey: import.meta.env?.OPENAI_API_KEY,
    +   compatibility: "strict"
    + });
    ```

    > 詳細な設定については、AI SDK のドキュメントをご覧ください。詳しくは [Provider Instance](https://ai-sdk.dev/providers/ai-sdk-providers/openai#provider-instance) を参照してください。

    ## Mastra開発サーバーを起動する \{#start-the-mastra-dev-server\}

    Mastra Dev Serverを起動して、エージェントをRESTエンドポイントとして公開します:

    <Tabs>
      <TabItem value="tab-1" label="タブ1">
        ```bash copy
        npm run dev:mastra
        ```
      </TabItem>

      <TabItem value="tab-2" label="タブ2">
        ```bash copy
        mastra dev:mastra
        ```
      </TabItem>
    </Tabs>

    > 実行を開始すると、エージェントはローカルで利用できるようになります。詳しくは[ローカル開発環境](/docs/getting-started/local-dev-playground)をご覧ください。

    ## Astro開発サーバーを起動する \{#start-astro-dev-server\}

    Mastra Dev Serverを起動した状態で、通常通りAstroサイトを起動できます。

    ## Actionsディレクトリを作成する \{#create-actions-directory\}

    ```bash copy
    mkdir src/actions
    ```

    ### テストアクションを作成 \{#create-test-action\}

    新しいアクションを作成し、サンプルコードを追加します:

    ```bash copy
    touch src/actions/index.ts
    ```

    ```typescript filename="src/actions/index.ts" showLineNumbers copy
    import { defineAction } from 'astro:actions';
    import { z } from 'astro:schema';

    import { mastra } from '../mastra';

    export const server = {
      getWeatherInfo: defineAction({
        input: z.object({
          city: z.string(),
        }),
        handler: async input => {
          const city = input.city;
          const agent = mastra.getAgent('weatherAgent');

          const result = await agent.generate(`${city}の天気はどうですか?`);

          return result.text;
        },
      }),
    };
    ```

    ### テストフォームを作成 \{#create-test-form\}

    新しいFormコンポーネントを作成し、サンプルコードを追加します:

    ```bash copy
    touch src/components/form.tsx
    ```

    ```typescript filename="src/components/form.tsx" showLineNumbers copy
    import { actions } from "astro:actions";
    import { useState } from "react";

    export const Form = () => {
      const [result, setResult] = useState<string | null>(null);

      async function handleSubmit(formData: FormData) {
        const city = formData.get("city")!.toString();
        const { data } = await actions.getWeatherInfo({ city });

        setResult(data || null);
      }

      return (
        <>
          <form action={handleSubmit}>
            <input name="city" placeholder="都市名を入力してください" required />
            <button type="submit">天気を取得</button>
          </form>
          {result && <pre>{result}</pre>}
        </>
      );
    };
    ```

    ### テストページを作成 \{#create-test-page\}

    新しいページを作成し、サンプルコードを追加します:

    ```bash copy
    touch src/pages/test.astro
    ```

    ```astro filename="src/pages/test.astro" showLineNumbers copy
    ---
    import { Form } from '../components/form'
    ---

    <h1>テスト</h1>
    <Form client:load />
    ```

    > ブラウザで`/test`にアクセスして、試してみてください。

    都市として**London**を送信すると、以下のような結果が返されます:

    ```plaintext
    エージェントの応答: ロンドンの現在の天気は以下の通りです:

    - **気温:** 12.9°C (体感温度 9.7°C)
    - **湿度:** 63%
    - **風速:** 14.7 km/h
    - **突風:** 32.4 km/h
    - **天候:** 曇り

    さらに情報が必要な場合はお知らせください!
    ```
  </TabItem>

  <TabItem value="サーバーエンドポイント" label="サーバー エンドポイント">
    :::warning

    このガイドは、VercelアダプターとReactを使用したAstroのエンドポイントを使用し、出力が`server`に設定されていることを前提としています。

    :::

    ## 前提条件 \{#prerequisites\}

    続行する前に、Astroプロジェクトが以下のように設定されていることを確認してください：

    * Astro の React 連携: [@astrojs/react](https://docs.astro.build/en/guides/integrations-guide/react/)
    * Vercel アダプタ：[@astrojs/vercel](https://docs.astro.build/en/guides/integrations-guide/vercel/)
    * `astro.config.mjs` で `output: "server"` が設定されています

    ## Mastraのインストール \{#install-mastra\}

    必要なMastraパッケージをインストールする:

    <Tabs>
      <TabItem value="install" label="インストール">
        ```bash copy
        npm install mastra@latest @mastra/core@latest @mastra/libsql@latest
        ```
      </TabItem>

      <TabItem value="tab-2" label="タブ 2">
        ```bash copy
        yarn add mastra@latest @mastra/core@latest @mastra/libsql@latest
        ```
      </TabItem>

      <TabItem value="tab-3" label="タブ 3">
        ```bash copy
        pnpm add mastra@latest @mastra/core@latest @mastra/libsql@latest
        ```
      </TabItem>

      <TabItem value="tab-4" label="タブ 4">
        ```bash copy
        bun add mastra@latest @mastra/core@latest @mastra/libsql@latest
        ```
      </TabItem>
    </Tabs>

    ## Mastraの統合 \{#integrate-mastra\}

    Mastraをプロジェクトに統合するには、2つのオプションがあります:

    ### 1. ワンライナーを使用する \{#1-use-the-one-liner\}

    以下のコマンドを実行して、適切なデフォルト設定を持つWeatherエージェントを素早く構築します:

    ```bash copy
    npx mastra@latest init --default
    ```

    > 詳細は [mastra init](/docs/reference/cli/mastra#mastra-init) をご覧ください。

    ### 2. インタラクティブCLIを使用する \{#2-use-the-interactive-cli\}

    セットアップをカスタマイズする場合は、`init`コマンドを実行し、プロンプトが表示されたら選択肢から選んでください:

    ```bash copy
    npx mastra@latest init
    ```

    `package.json`に`dev`と`build`スクリプトを追加します:

    ```json filename="package.json"
    {
      "scripts": {
        ...
        "dev:mastra": "mastra dev",
        "build:mastra": "mastra build"
      }
    }
    ```

    ## TypeScriptを設定する \{#configure-typescript\}

    プロジェクトルートの `tsconfig.json` ファイルを変更します:

    ```json filename="tsconfig.json"
    {
      ...
      "exclude": ["dist", ".mastra"]
    }
    ```

    ## APIキーの設定 \{#set-up-api-key\}

    ```bash filename=".env" copy
    OPENAI_API_KEY=<your-api-key>
    ```

    ## .gitignore を更新する \{#update-gitignore\}

    `.mastra` を `.gitignore` ファイルに追加します:

    ```bash filename=".gitignore" copy
    .mastra
    .vercel
    ```

    ## Mastraエージェントを更新する \{#update-the-mastra-agent\}

    Astroは`process.env`ではなく`import.meta.env`を介して環境変数にアクセスするViteを使用しています。そのため、モデルコンストラクタは次のようにVite環境から`apiKey`を明示的に受け取る必要があります:

    ```diff filename="src/mastra/agents/weather-agent.ts"
    - import { openai } from "@ai-sdk/openai";
    + import { createOpenAI } from "@ai-sdk/openai";

    + const openai = createOpenAI({
    +   apiKey: import.meta.env?.OPENAI_API_KEY,
    +   compatibility: "strict"
    + });
    ```

    > より詳しい設定内容は AI SDK のドキュメントをご覧ください。詳細は [Provider Instance](https://ai-sdk.dev/providers/ai-sdk-providers/openai#provider-instance) を参照してください。

    ## Mastra開発サーバーを起動する \{#start-the-mastra-dev-server\}

    Mastra Dev Serverを起動して、エージェントをRESTエンドポイントとして公開します:

    <Tabs>
      <TabItem value="tab-1" label="タブ 1">
        ```bash copy
        npm run dev:mastra
        ```
      </TabItem>

      <TabItem value="tab-2" label="タブ 2">
        ```bash copy
        mastra dev:mastra
        ```
      </TabItem>
    </Tabs>

    > 実行すると、エージェントはローカルで利用できるようになります。詳しくは [ローカル開発環境](/docs/getting-started/local-dev-playground) を参照してください。

    ## Astro開発サーバーを起動する \{#start-astro-dev-server\}

    Mastra Dev Serverを起動した状態で、通常通りAstroサイトを起動できます。

    ## APIディレクトリを作成する \{#create-api-directory\}

    ```bash copy
    mkdir src/pages/api
    ```

    ### テストエンドポイントを作成する \{#create-test-endpoint\}

    新しいエンドポイントを作成し、サンプルコードを追加します:

    ```bash copy
    touch src/pages/api/test.ts
    ```

    ```typescript filename="src/pages/api/test.ts" showLineNumbers copy
    import type { APIRoute } from 'astro';

    import { mastra } from '../../mastra';

    export const POST: APIRoute = async ({ request }) => {
      const { city } = await new Response(request.body).json();
      const agent = mastra.getAgent('weatherAgent');

      const result = await agent.generate(`${city}の天気はどうですか?`);

      return new Response(JSON.stringify(result.text));
    };
    ```

    ### テストフォームを作成 \{#create-test-form\}

    新しいFormコンポーネントを作成し、サンプルコードを追加します:

    ```bash copy
    touch src/components/form.tsx
    ```

    ```typescript filename="src/components/form.tsx" showLineNumbers copy
    import { useState } from "react";

    export const Form = () => {
      const [result, setResult] = useState<string | null>(null);

      async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const formData = new FormData(event.currentTarget);
        const city = formData.get("city")?.toString();

        const response = await fetch("/api/test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ city })
        });

        const text = await response.json();
        setResult(text);
      }

      return (
        <>
          <form onSubmit={handleSubmit}>
            <input name="city" placeholder="都市名を入力してください" required />
            <button type="submit">天気を取得</button>
          </form>
          {result && <pre>{result}</pre>}
        </>
      );
    };
    ```

    ### テストページを作成 \{#create-test-page\}

    新しいページを作成し、サンプルコードを追加します:

    ```bash copy
    touch src/pages/test.astro
    ```

    ```astro filename="src/pages/test.astro" showLineNumbers copy
    ---
    import { Form } from '../components/form'
    ---

    <h1>テスト</h1>
    <Form client:load />
    ```

    > ブラウザで `/test` にアクセスして試せます。

    都市として**London**を送信すると、以下のような結果が返されます:

    ```plaintext
    エージェントの応答: ロンドンの現在の天気は以下の通りです:

    - **気温:** 12.9°C (体感温度 9.7°C)
    - **湿度:** 63%
    - **風速:** 14.7 km/h
    - **突風:** 32.4 km/h
    - **天候:** 曇り

    さらに情報が必要な場合はお知らせください!
    ```
  </TabItem>
</Tabs>

## 次のステップ \{#next-steps\}

* [デプロイ | Vercel 上での Astro](/docs/deployment/web-framework#with-astro-on-vercel)
* [モノレポのデプロイ](/docs/deployment/monorepo)
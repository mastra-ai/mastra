---
title: "SvelteKit で"
description: Mastra を SvelteKit に統合するためのステップバイステップガイド
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# SvelteKit プロジェクトに Mastra を統合する \{#integrate-mastra-in-your-sveltekit-project\}

Mastra は SvelteKit と統合されており、次のことが簡単に行えます：

* AI 搭載の機能を提供する柔軟な API を構築する
* フロントエンドとバックエンドを単一のコードベースでまとめて、デプロイを簡素化する
* 効率的なサーバー・クライアント間のワークフローのために、SvelteKit の組み込みの [Actions](https://kit.svelte.dev/docs/form-actions) や [Server Endpoints](https://svelte.dev/docs/kit/routing#server) を活用する

このガイドを参考に、SvelteKit プロジェクトに Mastra をセットアップして統合しましょう。

<Tabs>
  <TabItem value="install-mastra" label="Mastra のインストール">
    ## Mastraのインストール \{#install-mastra\}

    必要なMastraパッケージをインストールする:

    <Tabs>
      <TabItem value="install" label="インストール">
        `bash copy
                                npm install mastra@latest @mastra/core@latest @mastra/libsql@latest
                                `
      </TabItem>

      <TabItem value="tab-3" label="タブ 3">
        `bash copy
                                yarn add mastra@latest @mastra/core@latest @mastra/libsql@latest
                                `
      </TabItem>

      <TabItem value="tab-4" label="タブ 4">
        `bash copy
                                pnpm add mastra@latest @mastra/core@latest @mastra/libsql@latest
                                `
      </TabItem>

      <TabItem value="tab-5" label="タブ 5">
        `bash copy
                                bun add mastra@latest @mastra/core@latest @mastra/libsql@latest
                                `
      </TabItem>
    </Tabs>

    ## Mastraの統合 \{#integrate-mastra\}

    プロジェクトにMastraを統合する方法は2つあります:

    ### 1. ワンライナーを使用する \{#1-use-the-one-liner\}

    以下のコマンドを実行して、適切なデフォルト設定を持つWeatherエージェントを素早く構築します:

    ```bash copy
    npx mastra@latest init --default
    ```

    > 詳しくは [mastra init](/docs/reference/cli/mastra#mastra-init) を参照してください。

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

    プロジェクトのルートにある `tsconfig.json` ファイルを変更します:

    ```json filename="tsconfig.json"
    {
      ...
      "exclude": ["dist", ".mastra"]
    }
    ```

    ## APIキーの設定 \{#set-up-api-key\}

    SvelteKitが使用するVite環境で環境変数にアクセスするには、`VITE_`プレフィックスが必要です。
    [Viteの環境変数について詳しく読む](https://vite.dev/guide/env-and-mode.html#env-variables)。

    ```bash filename=".env" copy
    VITE_OPENAI_API_KEY=<your-api-key>
    ```

    ## .gitignore を更新する \{#update-gitignore\}

    `.mastra` を `.gitignore` ファイルに追加します:

    ```bash filename=".gitignore" copy
    .mastra
    ```

    ## Mastraエージェントを更新する \{#update-the-mastra-agent\}

    ```diff filename="src/mastra/agents/weather-agent.ts"
    - import { openai } from "@ai-sdk/openai";
    + import { createOpenAI } from "@ai-sdk/openai";

    + const openai = createOpenAI({
    +   apiKey: import.meta.env?.VITE_OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY,
    +   compatibility: "strict"
    + });
    ```

    `import.meta.env`と`process.env`の両方から環境変数を読み取ることで、SvelteKit開発サーバーとMastra開発サーバーの両方でAPIキーを使用できるようにします。

    > より詳しい設定内容は AI SDK のドキュメントで確認できます。詳細は [Provider Instance](https://ai-sdk.dev/providers/ai-sdk-providers/openai#provider-instance) をご覧ください。

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

    > 実行を開始すると、エージェントはローカルで利用できるようになります。詳細は [ローカル開発環境](/docs/getting-started/local-dev-playground) を参照してください。

    ## SvelteKit開発サーバーを起動する \{#start-sveltekit-dev-server\}

    Mastra Dev Serverを起動した状態で、通常通りSvelteKitサイトを開始できます。

    ## テストディレクトリを作成する \{#create-test-directory\}

    ```bash copy
    mkdir src/routes/test
    ```

    ### テストアクションを作成 \{#create-test-action\}

    新しいアクションを作成し、サンプルコードを追加します:

    ```bash copy
    touch src/routes/test/+page.server.ts
    ```

    ```typescript filename="src/routes/test/+page.server.ts" showLineNumbers copy
    import type { Actions } from './$types';
    import { mastra } from '../../mastra';

    export const actions = {
      default: async event => {
        const city = (await event.request.formData()).get('city')!.toString();
        const agent = mastra.getAgent('weatherAgent');

        const result = await agent.generate(`${city}の天気はどうですか?`);
        return { result: result.text };
      },
    } satisfies Actions;
    ```

    ### テストページを作成 \{#create-test-page\}

    新しいPageファイルを作成し、サンプルコードを追加します:

    ```bash copy
    touch src/routes/test/+page.svelte
    ```

    ```typescript filename="src/routes/test/+page.svelte" showLineNumbers copy
    <script lang="ts">
    	import type { PageProps } from './$types';
    	let { form }: PageProps = $props();
    </script>

    <h1>テスト</h1>

    <form method="POST">
    	<input name="city" placeholder="都市名を入力してください" required />
    	<button type="submit">天気を取得</button>
    </form>

    {#if form?.result}
    	<pre>{form.result}</pre>
    {/if}
    ```

    > ブラウザで `/test` にアクセスして試してみてください。

    都市として**London**を送信すると、以下のような結果が返されます:

    ```plaintext
    ロンドンの現在の天気は以下の通りです:

    - **気温:** 16°C (体感温度 13.8°C)
    - **湿度:** 62%
    - **風速:** 12.6 km/h
    - **突風:** 32.4 km/h
    - **天候:** 曇り

    さらに詳しい情報や他の地域の情報が必要な場合は、お気軽にお尋ねください!
    ```
  </TabItem>

  <TabItem value="サーバー エンドポイント" label="サーバーのエンドポイント">
    ## Mastraのインストール \{#install-mastra\}

    必要なMastraパッケージをインストールする:

    <Tabs>
      <TabItem value="install" label="インストール">
        `bash copy
                                npm install mastra@latest @mastra/core@latest @mastra/libsql@latest
                                `
      </TabItem>

      <TabItem value="tab-2" label="タブ 2">
        `bash copy
                                yarn add mastra@latest @mastra/core@latest @mastra/libsql@latest
                                `
      </TabItem>

      <TabItem value="tab-3" label="タブ 3">
        `bash copy
                                pnpm add mastra@latest @mastra/core@latest @mastra/libsql@latest
                                `
      </TabItem>

      <TabItem value="tab-4" label="タブ 4">
        `bash copy
                                bun add mastra@latest @mastra/core@latest @mastra/libsql@latest
                                `
      </TabItem>
    </Tabs>

    ## Mastraの統合 \{#integrate-mastra\}

    プロジェクトにMastraを統合する方法は2つあります:

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

    プロジェクトのルートにある `tsconfig.json` ファイルを変更します:

    ```json filename="tsconfig.json"
    {
      ...
      "exclude": ["dist", ".mastra"]
    }
    ```

    ## APIキーの設定 \{#set-up-api-key\}

    SvelteKitが使用するVite環境で環境変数にアクセスするには、`VITE_`プレフィックスが必要です。
    [Viteの環境変数について詳しく読む](https://vite.dev/guide/env-and-mode.html#env-variables)。

    ```bash filename=".env" copy
    VITE_OPENAI_API_KEY=<your-api-key>
    ```

    ## .gitignore を更新する \{#update-gitignore\}

    `.mastra` を `.gitignore` ファイルに追加します:

    ```bash filename=".gitignore" copy
    .mastra
    ```

    ## Mastraエージェントを更新する \{#update-the-mastra-agent\}

    ```diff filename="src/mastra/agents/weather-agent.ts"
    - import { openai } from "@ai-sdk/openai";
    + import { createOpenAI } from "@ai-sdk/openai";

    + const openai = createOpenAI({
    +   apiKey: import.meta.env?.VITE_OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY,
    +   compatibility: "strict"
    + });
    ```

    `import.meta.env`と`process.env`の両方から環境変数を読み取ることで、SvelteKit開発サーバーとMastra開発サーバーの両方でAPIキーを使用できるようにします。

    > より詳しい設定については AI SDK のドキュメントを参照してください。詳細は [Provider Instance](https://ai-sdk.dev/providers/ai-sdk-providers/openai#provider-instance) をご覧ください。

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

    > 起動すると、エージェントはローカルで利用できるようになります。詳しくは [ローカル開発環境](/docs/getting-started/local-dev-playground) を参照してください。

    ## SvelteKit開発サーバーを起動する \{#start-sveltekit-dev-server\}

    Mastra Dev Serverを起動した状態で、通常通りSvelteKitサイトを開始できます。

    ## APIディレクトリを作成する \{#create-api-directory\}

    ```bash copy
    mkdir src/routes/weather-api
    ```

    ### テストエンドポイントを作成する \{#create-test-endpoint\}

    新しいエンドポイントを作成し、サンプルコードを追加します:

    ```bash copy
    touch src/routes/weather-api/+server.ts
    ```

    ```typescript filename="src/routes/weather-api/+server.ts" showLineNumbers copy
    import { json } from '@sveltejs/kit';
    import { mastra } from '../../mastra';

    export async function POST({ request }) {
      const { city } = await request.json();

      const response = await mastra.getAgent('weatherAgent').generate(`${city}の天気はどうですか?`);

      return json({ result: response.text });
    }
    ```

    ### テストページを作成 \{#create-test-page\}

    新しいページを作成し、サンプルコードを追加します:

    ```bash copy
    touch src/routes/weather-api-test/+page.svelte
    ```

    ```typescript filename="src/routes/weather-api-test/+page.svelte" showLineNumbers copy
    <script lang="ts">
    	let result = $state<string | null>(null);
    	async function handleFormSubmit(event: Event) {
    		event.preventDefault();
    		const formData = new FormData(event.currentTarget);
    		const city = formData.get('city')?.toString();
    		if (city) {
    			const response = await fetch('/weather-api', {
    				method: 'POST',
    				headers: {
    					'Content-Type': 'application/json'
    				},
    				body: JSON.stringify({ city })
    			});
    			const data = await response.json();
    			result = data.result;
    		}
    	}
    </script>

    <h1>テスト</h1>
    <form method="POST" onsubmit={handleFormSubmit}>
    	<input name="city" placeholder="都市名を入力してください" required />
    	<button type="submit">天気を取得</button>
    </form>

    {#if result}
    	<pre>{result}</pre>
    {/if}
    ```

    > ブラウザで `/weather-api-test` にアクセスして試してみてください。

    都市として**London**を送信すると、以下のような結果が返されます:

    ```plaintext
    ロンドンの現在の天気は以下の通りです:

    - **気温:** 16.1°C(体感温度14.2°C)
    - **湿度:** 64%
    - **風速:** 11.9 km/h
    - **突風:** 30.6 km/h
    - **天候:** 曇り

    詳細情報や他の地域の情報が必要な場合は、お気軽にお尋ねください!
    ```
  </TabItem>
</Tabs>

## Next steps

* [Monorepo Deployment](/docs/deployment/monorepo)
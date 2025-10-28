---
title: "Next.js で"
description: Mastra を Next.js に統合するためのステップバイステップガイド
sidebar_position: 2
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Next.js プロジェクトに Mastra を統合する \{#integrate-mastra-in-your-nextjs-project\}

Mastra は Next.js と統合でき、次のことが簡単に行えます。

* 柔軟な API を構築して、AI 搭載の機能を提供する
* フロントエンドとバックエンドを統合した単一コードベースで、デプロイを簡素化する
* 効率的なサーバー・クライアント間のワークフローのために、Next.js の組み込みの Server Actions（App Router）または API Routes（Pages Router）を活用する

このガイドを参考に、Next.js プロジェクトで Mastra の雛形作成と統合を行いましょう。

<Tabs>
  <TabItem value="integrate-mastra" label="Mastra を組み込む">
    :::warning

    このガイドは、プロジェクトのルートで Next.js の App Router を使用していることを前提としています（例：`src/app` ではなく `app`）。

    :::

    ## Mastra を統合する \{#integrate-mastra\}

    Mastra をプロジェクトに統合するには、次の2つの方法があります。

    ### 1. ワンライナーを使う \{#1-use-the-one-liner\}

    以下のコマンドを実行すると、適切な既定設定で Weather エージェントのテンプレートを素早く作成できます。

    ```bash copy
    npx mastra@latest init --dir . --components agents,tools --example --llm openai
    ```

    > 詳細は [mastra init](/docs/reference/cli/mastra#mastra-init) を参照してください。

    ### 2. 対話型 CLI を使う \{#2-use-the-interactive-cli\}

    セットアップをカスタマイズしたい場合は、`init` コマンドを実行し、表示されるプロンプトに従ってオプションを選択してください。

    ```bash copy
    npx mastra@latest init
    ```

    :::warning

    デフォルトでは、`mastra init` はインストール先として `src` を提案します。プロジェクトのルートで App Router を使用している場合（例：`app`。`src/app` ではない）、プロンプトで求められたら `.` を入力してください。

    :::

    ## API キーの設定 \{#set-up-api-key\}

    ```bash filename=".env" copy
    OPENAI_API_KEY=<あなたのAPIキー>
    ```

    > 各LLMプロバイダーは、それぞれ異なる環境変数を使用します。詳しくは[Model Capabilities](/docs/models)をご覧ください。

    ## Next.js を設定する \{#configure-nextjs\}

    `next.config.ts`に以下を追加します：

    ```typescript filename="next.config.ts" showLineNumbers copy
    import type { NextConfig } from 'next';

    const nextConfig: NextConfig = {
      serverExternalPackages: ['@mastra/*'],
    };

    export default nextConfig;
    ```

    ## Next.js の開発サーバーを起動する \{#start-nextjs-dev-server\}

    通常どおりに Next.js アプリを起動できます。

    ## テスト用ディレクトリを作成する \{#create-test-directory\}

    テスト用に、Page、Action、Form を含む新しいディレクトリを作成します。

    ```bash copy
    mkdir app/test
    ```

    ### テストアクションを作成 \{#create-test-action\}

    新しいアクションを作成し、次のサンプルコードを追加します:

    ```bash copy
    touch app/test/action.ts
    ```

    ```typescript filename="app/test/action.ts" showLineNumbers copy
    'use server';

    import { mastra } from '../../mastra';

    export async function getWeatherInfo(formData: FormData) {
      const city = formData.get('city')?.toString();
      const agent = mastra.getAgent('weatherAgent');

      const result = await agent.generate(`${city}の天気はどうですか？`);

      return result.text;
    }
    ```

    ### テストフォームを作成する \{#create-test-form\}

    新しい Form コンポーネントを作成し、以下のサンプルコードを追加します：

    ```bash copy
    touch app/test/form.tsx
    ```

    ```typescript filename="app/test/form.tsx" showLineNumbers copy
    "use client";

    import { useState } from "react";
    import { getWeatherInfo } from "./action";

    export function Form() {
      const [result, setResult] = useState<string | null>(null);

      async function handleSubmit(formData: FormData) {
        const res = await getWeatherInfo(formData);
        setResult(res);
      }

      return (
        <>
          <form action={handleSubmit}>
            <input name="city" placeholder="都市名を入力してください" required />
            <button type="submit">天気を確認</button>
          </form>
          {result && <pre>{result}</pre>}
        </>
      );
    }
    ```

    ### テストページを作成する \{#create-test-page\}

    新しいページを作成し、以下のサンプルコードを追加します：

    ```bash copy
    touch app/test/page.tsx
    ```

    ```typescript filename="app/test/page.tsx" showLineNumbers copy
    import { Form } from "./form";

    export default async function Page() {
      return (
        <>
          <h1>テスト</h1>
          <Form />
        </>
      );
    }
    ```

    > これでブラウザで `/test` にアクセスして試せます。

    都市名に **London** を入力して送信すると、次のような結果が返ってきます。

    ```plaintext
    エージェントからの回答: ロンドンの現在の天気は次のとおりです:

    - **気温:** 12.9°C（体感温度 9.7°C）
    - **湿度:** 63%
    - **風速:** 14.7 km/h
    - **最大瞬間風速:** 32.4 km/h
    - **天気:** 曇り

    ほかに必要な情報があればお知らせください。
    ```
  </TabItem>

  <TabItem value="mastra-pages-の統合" label="Mastra を統合する（Pages ルーター）">
    :::warning

    このガイドは、プロジェクトのルートで Next.js の Pages Router を使用していることを前提としています。例: `src/pages` ではなく `pages` を使用します。

    :::

    ## Mastra を統合する \{#integrate-mastra\}

    プロジェクトに Mastra を導入するには、次の2つの方法があります。

    ### 1. ワンライナーを使う \{#1-use-the-one-liner\}

    以下のコマンドを実行すると、妥当な初期設定のデフォルトの Weather エージェントを素早く雛形作成できます。

    ```bash copy
    npx mastra@latest init --dir . --components agents,tools --example --llm openai
    ```

    > 詳細は [mastra init](/docs/reference/cli/mastra#mastra-init) を参照してください。

    ### 2. 対話型CLIを使用する \{#2-use-the-interactive-cli\}

    セットアップをカスタマイズしたい場合は、`init` コマンドを実行し、表示されるプロンプトでオプションを選択してください。

    ```bash copy
    npx mastra@latest init
    ```

    :::warning

    デフォルトでは、`mastra init` はインストール先として `src` を提案します。プロジェクトのルートで Pages Router を使っている場合（例：`pages`、`src/pages` ではない場合）は、プロンプトが表示されたら `.` を入力してください。

    :::

    ## API キーの設定 \{#set-up-api-key\}

    ```bash filename=".env" copy
    OPENAI_API_KEY=<あなたの API キー>
    ```

    > 各LLMプロバイダーは異なる環境変数を使用します。詳しくは [Model Capabilities](/docs/models) をご覧ください。

    ## Next.js の設定 \{#configure-nextjs\}

    `next.config.ts` に以下を追加します:

    ```typescript filename="next.config.ts" showLineNumbers copy
    import type { NextConfig } from 'next';

    const nextConfig: NextConfig = {
      serverExternalPackages: ['@mastra/*'],
    };

    export default nextConfig;
    ```

    ## Next.js の開発サーバーを起動する \{#start-nextjs-dev-server\}

    通常どおり Next.js アプリを起動します。

    ## テスト用の API ルートを作成する \{#create-test-api-route\}

    新しい API ルートを作成し、サンプルコードを追加します。

    ```bash copy
    touch pages/api/test.ts
    ```

    ```typescript filename="pages/api/test.ts" showLineNumbers copy
    import type { NextApiRequest, NextApiResponse } from 'next';

    import { mastra } from '../../mastra';

    export default async function getWeatherInfo(req: NextApiRequest, res: NextApiResponse) {
      const city = req.body.city;
      const agent = mastra.getAgent('weatherAgent');

      const result = await agent.generate(`${city}の天気はどうですか?`);

      return res.status(200).json(result.text);
    }
    ```

    ## テストページを作成する \{#create-test-page\}

    新しいページを作成し、サンプルコードを追加します:

    ```bash copy
    touch pages/test.tsx
    ```

    ```typescript filename="pages/test.tsx" showLineNumbers copy
    import { useState } from "react";

    export default function Test() {
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
          <h1>テスト</h1>
          <form onSubmit={handleSubmit}>
            <input name="city" placeholder="都市名を入力してください" required />
            <button type="submit">天気を取得</button>
          </form>
          {result && <pre>{result}</pre>}
        </>
      );
    }
    ```

    > これでブラウザで `/test` にアクセスして試せるようになりました。

    都市名として **London** を送信すると、次のような結果が返ってきます：

    ```plaintext
    Agent response: ロンドンの現在の天気は次のとおりです。

    - **気温:** 12.9°C（体感 9.7°C）
    - **湿度:** 63%
    - **風速:** 14.7 km/h
    - **最大風速:** 32.4 km/h
    - **天候:** 曇り

    ほかに必要な情報があればお知らせください。
    ```
  </TabItem>
</Tabs>

## 次のステップ \{#next-steps\}

* [デプロイ | Vercel 上の Next.js を使用](/docs/deployment/web-framework#with-nextjs-on-vercel)
* [Monorepo でのデプロイ](/docs/deployment/monorepo)
---
title: "CopilotKit とともに"
description: "Mastra が CopilotKit の AGUI ライブラリをどのように活用しているか、またそれを用いてユーザー体験を構築する方法を学びましょう"
sidebar_position: 2
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Mastra と CopilotKit を統合する \{#integrate-copilotkit-with-mastra\}

CopilotKit は、カスタマイズ可能な AI コパイロットをアプリケーションに迅速に組み込むための React コンポーネントを提供します。Mastra と組み合わせることで、双方向の状態同期やインタラクティブな UI を備えた高度な AI アプリを構築できます。

[CopilotKit のドキュメント](https://docs.copilotkit.ai/)を参照して、CopilotKit の概念、コンポーネント、上級の活用パターンについて学んでください。

このガイドでは、2 つの異なる統合アプローチを紹介します：

1. 別の React フロントエンドを使用し、Mastra サーバーに CopilotKit を統合する。
2. Next.js アプリに CopilotKit を統合する。

<Tabs>
  <TabItem value="mastra-server" label="Mastra サーバー" default>
    ## React の依存関係をインストール \{#install-react-dependencies\}

    React フロントエンドで必要な CopilotKit パッケージをインストールします:

    <Tabs groupId="package-manager">
      <TabItem value="npm" label="npm" default>
        ```bash copy
        npm install @copilotkit/react-core @copilotkit/react-ui
        ```
      </TabItem>

      <TabItem value="yarn" label="yarn">
        ```bash copy
        yarn add @copilotkit/react-core @copilotkit/react-ui
        ```
      </TabItem>

      <TabItem value="pnpm" label="pnpm">
        ```bash copy
        pnpm add @copilotkit/react-core @copilotkit/react-ui
        ```
      </TabItem>
    </Tabs>

    ## CopilotKit コンポーネントを作成 \{#create-copilotkit-component\}

    React フロントエンドで CopilotKit コンポーネントを作成します:

    ```tsx filename="components/copilotkit-component.tsx" showLineNumbers copy
    import { CopilotChat } from '@copilotkit/react-ui';
    import { CopilotKit } from '@copilotkit/react-core';
    import '@copilotkit/react-ui/styles.css';

    export function CopilotKitComponent({ runtimeUrl }: { runtimeUrl: string }) {
      return (
        <CopilotKit runtimeUrl={runtimeUrl} agent="weatherAgent">
          <CopilotChat
            labels={{
              title: 'アシスタント',
              initial: 'こんにちは!👋 今日は何をお手伝いしましょうか?',
            }}
          />
        </CopilotKit>
      );
    }
    ```

    ## 依存関係のインストール \{#install-dependencies\}

    まだ Mastra サーバーをセットアップしていない場合は、[クイックスタートガイド](/docs/getting-started/installation)に従って新しい Mastra プロジェクトを作成してください。

    Mastra サーバーで、CopilotKit 統合のための追加パッケージをインストールします。

    <Tabs groupId="package-manager">
      <TabItem value="npm" label="npm" default>
        ```bash copy
        npm install @copilotkit/runtime @ag-ui/mastra
        ```
      </TabItem>

      <TabItem value="yarn" label="yarn">
        ```bash copy
        yarn add @copilotkit/runtime @ag-ui/mastra
        ```
      </TabItem>

      <TabItem value="pnpm" label="pnpm">
        ```bash copy
        pnpm add @copilotkit/runtime @ag-ui/mastra
        ```
      </TabItem>
    </Tabs>

    ## Mastra サーバーの設定 \{#configure-mastra-server\}

    Mastra インスタンスを設定し、CopilotKit のランタイムエンドポイントを含めます。

    ```typescript filename="src/mastra/index.ts" showLineNumbers copy {5-8,12-28}
    import { Mastra } from '@mastra/core/mastra';
    import { registerCopilotKit } from '@ag-ui/mastra';
    import { weatherAgent } from './agents/weather-agent';

    type WeatherRuntimeContext = {
      'user-id': string;
      'temperature-scale': 'celsius' | 'fahrenheit';
    };

    export const mastra = new Mastra({
      agents: { weatherAgent },
      server: {
        cors: {
          origin: '*',
          allowMethods: ['*'],
          allowHeaders: ['*'],
        },
        apiRoutes: [
          registerCopilotKit<WeatherRuntimeContext>({
            path: '/copilotkit',
            resourceId: 'weatherAgent',
            setContext: (c, runtimeContext) => {
              runtimeContext.set('user-id', c.req.header('X-User-ID') || 'anonymous');
              runtimeContext.set('temperature-scale', 'celsius');
            },
          }),
        ],
      },
    });
    ```

    ## React アプリでの使い方 \{#usage-in-your-react-app\}

    Mastra サーバーの URL を指定して、React アプリでこのコンポーネントを使用します。

    ```tsx filename="App.tsx" showLineNumbers copy {5}
    import { CopilotKitComponent } from './components/copilotkit-component';

    function App() {
      return <CopilotKitComponent runtimeUrl="http://localhost:4111/copilotkit" />;
    }

    export default App;
    ```
  </TabItem>

  <TabItem value="Next.js" label="Next.js">
    ## 依存関係のインストール \{#install-dependencies\}

    Next.jsアプリに、必要なパッケージをインストールします:

    <Tabs groupId="package-manager">
      <TabItem value="npm" label="npm" default>
        ```bash copy
        npm install @copilotkit/react-core @copilotkit/react-ui @copilotkit/runtime @ag-ui/mastra
        ```
      </TabItem>

      <TabItem value="yarn" label="yarn">
        ```bash copy
        yarn add @copilotkit/react-core @copilotkit/react-ui @copilotkit/runtime @ag-ui/mastra
        ```
      </TabItem>

      <TabItem value="pnpm" label="pnpm">
        ```bash copy
        pnpm add @copilotkit/react-core @copilotkit/react-ui @copilotkit/runtime @ag-ui/mastra
        ```
      </TabItem>
    </Tabs>

    ## CopilotKitコンポーネントの作成 [#full-stack-nextjs-create-copilotkit-component]

    CopilotKitコンポーネントを作成する:

    ```tsx filename="components/copilotkit-component.tsx" showLineNumbers copy
    'use client';
    import { CopilotChat } from '@copilotkit/react-ui';
    import { CopilotKit } from '@copilotkit/react-core';
    import '@copilotkit/react-ui/styles.css';

    export function CopilotKitComponent({ runtimeUrl }: { runtimeUrl: string }) {
      return (
        <CopilotKit runtimeUrl={runtimeUrl} agent="weatherAgent">
          <CopilotChat
            labels={{
              title: 'アシスタント',
              initial: 'こんにちは!👋 今日はどうされましたか?',
            }}
          />
        </CopilotKit>
      );
    }
    ```

    ## APIルートを作成する \{#create-api-route\}

    Next.jsアプリケーションへのMastraの統合方法に応じて、APIルートには2つのアプローチがあります。

    1. Mastra のインスタンスをアプリに統合した、フルスタックの Next.js アプリ向け。
    2. 別個の Mastra サーバーと Mastra Client SDK を使用する Next.js アプリの場合。

    <Tabs>
      <TabItem value="local-mastra" label="ローカル Mastra エージェント" default>
        ローカルの Mastra エージェントに接続する API ルートを作成します。

        ```typescript filename="app/api/copilotkit/route.ts" showLineNumbers copy {1-7,11-26}
        import { mastra } from '../../mastra';
        import { CopilotRuntime, ExperimentalEmptyAdapter, copilotRuntimeNextJSAppRouterEndpoint } from '@copilotkit/runtime';
        import { MastraAgent } from '@ag-ui/mastra';
        import { NextRequest } from 'next/server';

        export const POST = async (req: NextRequest) => {
          const mastraAgents = MastraAgent.getLocalAgents({
            mastra,
            agentId: 'weatherAgent',
          });

          const runtime = new CopilotRuntime({
            agents: mastraAgents,
          });

          const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
            runtime,
            serviceAdapter: new ExperimentalEmptyAdapter(),
            endpoint: '/api/copilotkit',
          });

          return handleRequest(req);
        };
        ```
      </TabItem>

      <TabItem value="remote-mastra" label="リモート Mastra (Client SDK)">
        ## Mastra Client SDK をインストール \{#install-the-mastra-client-sdk\}

        Mastra Client SDK をインストールします。

        <Tabs groupId="package-manager">
          <TabItem value="npm" label="npm" default>
            ```bash copy
            npm install @mastra/client-js
            ```
          </TabItem>

          <TabItem value="yarn" label="yarn">
            ```bash copy
            yarn add @mastra/client-js
            ```
          </TabItem>

          <TabItem value="pnpm" label="pnpm">
            ```bash copy
             pnpm add @mastra/client-js
            ```
          </TabItem>
        </Tabs>

        リモートの Mastra エージェントに接続する API ルートを作成します。

        ```typescript filename="app/api/copilotkit/route.ts" showLineNumbers copy {1-7,12-26}
        import { MastraClient } from '@mastra/client-js';
        import { CopilotRuntime, ExperimentalEmptyAdapter, copilotRuntimeNextJSAppRouterEndpoint } from '@copilotkit/runtime';
        import { MastraAgent } from '@ag-ui/mastra';
        import { NextRequest } from 'next/server';

        export const POST = async (req: NextRequest) => {
          const baseUrl = process.env.MASTRA_BASE_URL || 'http://localhost:4111';
          const mastraClient = new MastraClient({ baseUrl });

          const mastraAgents = await MastraAgent.getRemoteAgents({ mastraClient });

          const runtime = new CopilotRuntime({
            agents: mastraAgents,
          });

          const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
            runtime,
            serviceAdapter: new ExperimentalEmptyAdapter(),
            endpoint: '/api/copilotkit',
          });

          return handleRequest(req);
        };
        ```
      </TabItem>
    </Tabs>

    ## コンポーネントを使用する \{#use-component\}

    ローカルAPIエンドポイントでコンポーネントを使用する:

    ```tsx filename="App.tsx" showLineNumbers copy {5}
    import { CopilotKitComponent } from './components/copilotkit-component';

    function App() {
      return <CopilotKitComponent runtimeUrl="/api/copilotkit" />;
    }

    export default App;
    ```
  </TabItem>
</Tabs>

未来を創り始めよう！

<br />

![CopilotKit output](/img/copilotkit/cpkoutput.jpg)

## 次のステップ \{#next-steps\}

* [CopilotKit Documentation](https://docs.copilotkit.ai) - CopilotKit の完全なリファレンス
* [React Hooks with CopilotKit](https://docs.copilotkit.ai/reference/hooks/useCoAgent) - React の高度な統合パターン
* [Next.js Integration with Mastra](/docs/frameworks/web-frameworks/next-js) - フルスタックの Next.js セットアップガイド
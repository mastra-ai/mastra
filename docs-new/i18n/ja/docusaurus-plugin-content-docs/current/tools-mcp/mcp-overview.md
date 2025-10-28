---
title: "MCP 概要"
description: Model Context Protocol（MCP）とは何か、MCPClient を通じてサードパーティ製ツールを利用する方法、レジストリに接続する方法、そして MCPServer を使って自作のツールを共有する方法を学びます。
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# MCP の概要 \{#mcp-overview\}

Mastra は、AI エージェントを外部のツールやリソースに接続するためのオープン標準である [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) をサポートしています。汎用プラグインシステムとして機能し、言語やホスティング環境にかかわらずエージェントがツールを呼び出せるようにします。

Mastra は MCP サーバーの作成にも使用でき、エージェント、ツール、その他の構造化リソースを MCP インターフェース経由で公開できます。これらは、プロトコルをサポートするあらゆるシステムやエージェントからアクセス可能です。

Mastra は現在、次の 2 つの MCP クラスをサポートしています:

1. **`MCPClient`**: ツール、リソース、プロンプトへのアクセスや、引き出しリクエストの処理のために、1 つまたは複数の MCP サーバーに接続します。
2. **`MCPServer`**: Mastra のツール、エージェント、ワークフロー、プロンプト、リソースを MCP 互換のクライアントに公開します。

## はじめに \{#getting-started\}

MCP を使用するには、必要な依存関係をインストールしてください。

```bash
npm install @mastra/mcp@latest
```

## `MCPClient` の設定 \{#configuring-mcpclient\}

`MCPClient` は Mastra のプリミティブを外部の MCP サーバーに接続します。サーバーは、ローカルのパッケージ（`npx` で起動）またはリモートの HTTP(S) エンドポイントのいずれかです。各サーバーは、ホスティング形態に応じて `command` か `url` のいずれかを指定して設定する必要があります。

```typescript filename="src/mastra/mcp/test-mcp-client.ts" showLineNumbers copy
import { MCPClient } from '@mastra/mcp';

export const testMcpClient = new MCPClient({
  id: 'test-mcp-client',
  servers: {
    wikipedia: {
      command: 'npx',
      args: ['-y', 'wikipedia-mcp'],
    },
    weather: {
      url: new URL(
        `https://server.smithery.ai/@smithery-ai/national-weather-service/mcp?api_key=${process.env.SMITHERY_API_KEY}`,
      ),
    },
  },
});
```

> 設定オプションの全一覧は [MCPClient](/docs/reference/tools/mcp-client) を参照してください。

## エージェントでの `MCPClient` の使用 \{#using-mcpclient-with-an-agent\}

エージェントで MCP サーバーのツールを使うには、`MCPClient` をインポートし、`tools` パラメータで `.getTools()` を呼び出します。これにより、定義済みの MCP サーバーからツールが読み込まれ、エージェントで利用できるようになります。

```typescript {4,16} filename="src/mastra/agents/test-agent.ts" showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';

import { testMcpClient } from '../mcp/test-mcp-client';

export const testAgent = new Agent({
  name: 'テストエージェント',
  description: 'あなたは有用なAIアシスタントです',
  instructions: `
      あなたは以下のMCPサーバーにアクセスできる有用なアシスタントです。
      - Wikipedia MCPサーバー
      - 米国国立気象局（NWS）

      MCPサーバーで取得した情報を用いて質問に回答してください。`,
  model: openai('gpt-4o-mini'),
  tools: await testMcpClient.getTools(),
});
```

> 構成オプションの一覧については、[Agent Class](/docs/reference/agents/agent)を参照してください。

## `MCPServer` の設定 \{#configuring-mcpserver\}

Mastra アプリのエージェント、ツール、ワークフローを HTTP(S) 経由で外部システムに公開するには、`MCPServer` クラスを使用します。これにより、プロトコルに対応するあらゆるシステムやエージェントからアクセスできるようになります。

```typescript filename="src/mastra/mcp/test-mcp-server.ts" showLineNumbers copy
import { MCPServer } from '@mastra/mcp';

import { testAgent } from '../agents/test-agent';
import { testWorkflow } from '../workflows/test-workflow';
import { testTool } from '../tools/test-tool';

export const testMcpServer = new MCPServer({
  id: 'test-mcp-server',
  name: 'テストサーバー',
  version: '1.0.0',
  agents: { testAgent },
  tools: { testTool },
  workflows: { testWorkflow },
});
```

> 設定オプションの一覧については、[MCPServer](/docs/reference/tools/mcp-server) を参照してください。

## `MCPServer` の登録 \{#registering-an-mcpserver\}

プロトコルをサポートする他のシステムやエージェントで MCP サーバーを利用可能にするには、メインの `Mastra` インスタンスの `mcpServers` で登録します。

```typescript filename="src/mastra/index.ts" showLineNumbers copy
import { Mastra } from '@mastra/core/mastra';

import { testMcpServer } from './mcp/test-mcp-server';

export const mastra = new Mastra({
  // ...
  mcpServers: { testMcpServer },
});
```

## 静的ツールと動的ツール \{#static-and-dynamic-tools\}

`MCPClient` では、接続先サーバーからツールを取得するために、アプリケーションのアーキテクチャに応じて使い分けられる2つのアプローチを提供しています:

| 機能              | 静的構成（`await mcp.getTools()`）            | 動的構成（`await mcp.getToolsets()`）                 |
| :---------------- | :-------------------------------------------- | :--------------------------------------------------- |
| **ユースケース**  | 単一ユーザー向け、静的設定（例: CLI ツール）  | 複数ユーザー向け、動的設定（例: SaaS アプリ）         |
| **構成**          | エージェントの初期化時に固定                  | リクエストごとに動的                                 |
| **認証情報**      | すべての利用で共有                            | ユーザー／リクエストごとに可変                       |
| **エージェント設定** | `Agent` のコンストラクターでツールを追加       | `.generate()` または `.stream()` のオプションでツールを渡す |

### 静的ツール \{#static-tools\}

`.getTools()` メソッドを使って、設定済みのすべての MCP サーバーからツールを取得します。これは、API キーなどの構成がユーザーやリクエスト間で不変かつ一貫している場合に適しています。エージェントを定義する際は一度だけ呼び出し、その結果を `tools` プロパティに渡してください。

> 詳細は [getTools()](/docs/reference/tools/mcp-client#gettools) を参照してください。

```typescript {8} filename="src/mastra/agents/test-agent.ts" showLineNumbers copy
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';

import { testMcpClient } from '../mcp/test-mcp-client';

export const testAgent = new Agent({
  // ...
  tools: await testMcpClient.getTools(),
});
```

### 動的ツール \{#dynamic-tools\}

各リクエストやユーザーによってツール設定が変わる可能性がある場合（例：各ユーザーが自分の API キーを提供するマルチテナントシステムなど）は、`.getToolsets()` メソッドを使用します。このメソッドは、エージェントの `.generate()` または `.stream()` の呼び出しで `toolsets` オプションに渡せるツールセットを返します。

```typescript {5-16,21} showLineNumbers copy
import { MCPClient } from '@mastra/mcp';
import { mastra } from './mastra';

async function handleRequest(userPrompt: string, userApiKey: string) {
  const userMcp = new MCPClient({
    servers: {
      weather: {
        url: new URL('http://localhost:8080/mcp'),
        requestInit: {
          headers: {
            Authorization: `Bearer ${userApiKey}`,
          },
        },
      },
    },
  });

  const agent = mastra.getAgent('testAgent');

  const response = await agent.generate(userPrompt, {
    toolsets: await userMcp.getToolsets(),
  });

  await userMcp.disconnect();

  return Response.json({
    data: response.text,
  });
}
```

> 詳細は [getToolsets()](/docs/reference/tools/mcp-client#gettoolsets) をご覧ください。

## MCPレジストリへの接続 \{#connecting-to-an-mcp-registry\}

MCPサーバーはレジストリ経由で検出できます。`MCPClient` を使って一般的なレジストリに接続する方法は次のとおりです。

<Tabs>
  <TabItem value="タブ1" label="タブ1">
    [Klavis AI](https://klavis.ai) は、ホスティングされ、エンタープライズ認証に対応した高品質な MCP サーバーを提供します。

    ```typescript
    import { MCPClient } from "@mastra/mcp";

    const mcp = new MCPClient({
      servers: {
        salesforce: {
          url: new URL("https://salesforce-mcp-server.klavis.ai/mcp/?instance_id={private-instance-id}"),
        },
        hubspot: {
          url: new URL("https://hubspot-mcp-server.klavis.ai/mcp/?instance_id={private-instance-id}"),
        },
      },
    });
    ```

    Klavis AI は、本番運用環境での導入に向けてエンタープライズ級の認証とセキュリティを提供します。

    Mastra を Klavis と統合する方法の詳細は、[ドキュメント](https://docs.klavis.ai/documentation/ai-platform-integration/mastra)をご参照ください。
  </TabItem>

  <TabItem value="タブ2" label="タブ2">
    [mcp.run](https://www.mcp.run/) は、事前認証済みのマネージド MCP サーバーを提供します。ツールはプロファイルごとにまとめられ、各プロファイルには固有で署名付きの URL が付与されます。

    ```typescript
    import { MCPClient } from "@mastra/mcp";

    const mcp = new MCPClient({
      servers: {
        marketing: { // プロファイル名の例
          url: new URL(process.env.MCP_RUN_SSE_URL!), // mcp.runプロファイルからURLを取得
        },
      },
    });
    ```

    > **重要:** mcp.run の SSE URL はパスワード同様に扱ってください。環境変数などに安全に保管しましょう。
    >
    > ```bash filename=".env"
    > MCP_RUN_SSE_URL=https://www.mcp.run/api/mcp/sse?nonce=...
    > ```
  </TabItem>

  <TabItem value="タブ3" label="タブ3">
    [Composio.dev](https://composio.dev) は、[SSE ベースの MCP サーバー](https://mcp.composio.dev) のレジストリを提供しています。Cursor などのツール向けに生成された SSE の URL をそのまま利用できます。

    ```typescript
    import { MCPClient } from "@mastra/mcp";

    const mcp = new MCPClient({
      servers: {
        googleSheets: {
          url: new URL("https://mcp.composio.dev/googlesheets/[private-url-path]"),
        },
        gmail: {
          url: new URL("https://mcp.composio.dev/gmail/[private-url-path]"),
        },
      },
    });
    ```

    Google Sheets などのサービスでの認証は、多くの場合、エージェントとのやり取りを通じて対話的に行われます。

    *注: Composio の URL は通常、単一のユーザーアカウントにひも付いているため、マルチテナントのアプリケーションよりも個人向けの自動化に適しています。*
  </TabItem>

  <TabItem value="タブ4" label="タブ4">
    [Smithery.ai](https://smithery.ai) は、CLI でアクセスできるレジストリを提供しています。

    ```typescript
    // Unix/Mac
    import { MCPClient } from "@mastra/mcp";

    const mcp = new MCPClient({
      servers: {
        sequentialThinking: {
          command: "npx",
          args: [
            "-y",
            "@smithery/cli@latest",
            "run",
            "@smithery-ai/server-sequential-thinking",
            "--config",
            "{}",
          ],
        },
      },
    });
    ```

    ```typescript
    // Windows
    import { MCPClient } from "@mastra/mcp";

    const mcp = new MCPClient({
      servers: {
        sequentialThinking: {
          command: "npx",
          args: [
            "-y",
            "@smithery/cli@latest",
            "run",
            "@smithery-ai/server-sequential-thinking",
            "--config",
            "{}",
          ],
        },
      },
    });
    ```
  </TabItem>

  <TabItem value="タブ5" label="タブ5">
    [Ampersand](https://withampersand.com?utm_source=mastra-docs) は、Salesforce、HubSpot、Zendesk などの SaaS 製品と 150 以上の連携を、エージェントに接続できる [MCP Server](https://docs.withampersand.com/mcp) を提供しています。

    ```typescript

    // SSEを使用したAmpersand MCPサーバーを利用するMCPClient
    export const mcp = new MCPClient({
        servers: {
        "@amp-labs/mcp-server": {
          "url": `https://mcp.withampersand.com/v1/sse?${new URLSearchParams({
            apiKey: process.env.AMPERSAND_API_KEY,
            project: process.env.AMPERSAND_PROJECT_ID,
            integrationName: process.env.AMPERSAND_INTEGRATION_NAME,
            groupRef: process.env.AMPERSAND_GROUP_REF
          })}`
        }
      }
    });

    ```

    ```typescript
    // MCPサーバーをローカルで実行する場合:

    import { MCPClient } from "@mastra/mcp";

    // stdioトランスポートを使用したAmpersand MCP ServerのMCPClient
    export const mcp = new MCPClient({
        servers: {
          "@amp-labs/mcp-server": {
            command: "npx",
            args: [
              "-y",
              "@amp-labs/mcp-server@latest",
              "--transport",
              "stdio",
              "--project",
              process.env.AMPERSAND_PROJECT_ID,
              "--integrationName",
              process.env.AMPERSAND_INTEGRATION_NAME,
              "--groupRef",
              process.env.AMPERSAND_GROUP_REF, // オプション
            ],
            env: {
              AMPERSAND_API_KEY: process.env.AMPERSAND_API_KEY,
            },
          },
        },
    });
    ```

    MCP の代替として、Ampersand の AI SDK には Mastra 用アダプターも用意されており、エージェントが利用できるように [Ampersand のツールを直接インポート](https://docs.withampersand.com/ai-sdk#use-with-mastra) できます。
  </TabItem>
</Tabs>

## 関連情報 \{#related\}

* [ツールとMCPの利用](../agents/using-tools-and-mcp)
* [MCPClient](/docs/reference/tools/mcp-client)
* [MCPServer](/docs/reference/tools/mcp-server)
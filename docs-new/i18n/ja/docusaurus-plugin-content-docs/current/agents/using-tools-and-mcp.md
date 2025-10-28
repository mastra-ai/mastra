---
title: "ツールの活用"
description: ツールの作成方法、Mastra エージェントへの追加方法、MCP サーバーからのツール統合方法を学びます。
sidebar_position: 2
---

# ツールとMCP \{#tools-and-mcp\}

ツールは、エージェントやワークフローがメッセージ送信、データベース照会、外部API呼び出しといった特定のタスクを実行するのに役立つ、型付き関数です。各ツールは想定する入力を定義し、処理を行うためのロジックを備え、外部システムにアクセスするために実行をMCPクライアントに委譲する場合があります。これにより、エージェントは単なる言語生成を超えて構造化された方法で動作し、明確に定義されたインターフェースを通じて決定的な結果を得られるようになります。

Mastraはエージェントにツールを提供するために、次の2つのパターンをサポートしています：

* **直接割り当て**：初期化時に利用可能な静的ツール
* **関数ベース**：実行時コンテキストに基づいて解決される動的ツール

## ツールの作成 \{#creating-a-tool\}

この例では、天気 API からデータを非同期に取得するシンプルなツールの作り方を示します。

```typescript filename="src/mastra/tools/weather-tool.ts" showLineNumbers copy
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const weatherTool = createTool({
  id: 'weather-tool',
  description: '指定された都市の現在の天気を取得します',
  inputSchema: z.object({
    city: z.string(),
  }),
  execute: async ({ context }) => {
    const { city } = context;
    const response = await fetch(`https://weather.service?city=${city}`);

    const { temperature, conditions } = await response.json();

    return { temperature, conditions };
  },
});
```

ツールの作成と設計の詳細は、[Tools Overview](../tools-mcp/overview) を参照してください。

## エージェントにツールを追加する \{#adding-tools-to-an-agent\}

ツールをエージェントで利用できるようにするには、エージェントの設定の `tools` プロパティに追加します。

```typescript {3,12} filename="src/mastra/agents/weather-agent.ts" showLineNumbers copy
import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { weatherTool } from '../tools/weather-tool';

export const weatherAgent = new Agent({
  name: 'Weather Agent',
  instructions: `
    あなたは天気情報を提供する親切なアシスタントです。
    天気について聞かれたら、weatherToolを使ってデータを取得してください。`,
  model: openai('gpt-4o-mini'),
  tools: {
    weatherTool,
  },
});
```

エージェントを呼び出すと、指示とユーザーのプロンプトに基づいて、設定済みのツールを使用するかどうかを判断できるようになりました。

## エージェントにMCPツールを追加する \{#adding-mcp-tools-to-an-agent\}

[Model Context Protocol（MCP）](https://modelcontextprotocol.io/introduction)は、AIモデルが外部のツールやリソースを発見して活用するための標準化された手段を提供します。サードパーティ製のツールを利用するために、MastraのエージェントをMCPサーバーに接続できます。

MCPの基本概念やMCPクライアント／サーバーのセットアップ方法の詳細は、[MCP概要](/docs/tools-mcp/mcp-overview)を参照してください。

### インストール \{#installation\}

まず、Mastra MCP パッケージをインストールします。

```bash npm2yarn copy
npm install @mastra/mcp@latest
```

### MCP ツールの使用 \{#using-mcp-tools\}

選べる MCP サーバーのレジストリが数多くあるため、MCP サーバーを見つけやすくする目的で [MCP Registry Registry](https://mastra.ai/mcp-registry-registry) を用意しました。

エージェントで使用したいサーバーが見つかったら、Mastra の `MCPClient` をインポートし、サーバー構成を追加します。

```typescript filename="src/mastra/mcp.ts" {1,7-16}
import { MCPClient } from '@mastra/mcp';

// MCPClientを設定してサーバーに接続する
export const mcp = new MCPClient({
  servers: {
    filesystem: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '/Users/username/Downloads'],
    },
  },
});
```

次に、エージェントをサーバーツールに接続します。

```typescript filename="src/mastra/agents/mcpAgent.ts" {7}
import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { mcp } from '../mcp';

// MCPクライアントからツールを追加してエージェントを作成
const agent = new Agent({
  name: 'MCPツール搭載エージェント',
  instructions: '接続されたMCPサーバーのツールが使用できます。',
  model: openai('gpt-4o-mini'),
  tools: await mcp.getTools(),
});
```

同じリポジトリ内の、接続先となる MCP サーバーを利用するエージェントを作成する場合は、競合状態を防ぐため、常に関数ベースのツールを使用してください。

```typescript filename="src/mastra/agents/selfReferencingAgent.ts"
import { Agent } from '@mastra/core/agent';
import { MCPServer } from '@mastra/mcp';
import { MCPClient } from '@mastra/mcp';
import { openai } from '@ai-sdk/openai';

const myAgent = new Agent({
  name: 'マイエージェント',
  description: 'HTTP MCPサーバーのツールを使用できるエージェント',
  instructions: 'リモート計算ツールを使用できます。',
  model: openai('gpt-4o-mini'),
  tools: async () => {
    // ツールは初期化時ではなく、必要なときに解決されます
    const mcpClient = new MCPClient({
      servers: {
        myServer: {
          url: new URL('http://localhost:4111/api/mcp/mcpServer/mcp'),
        },
      },
    });
    return await mcpClient.getTools();
  },
});

// サーバー起動後にツールが解決されるため、これは正常に動作します
export const mcpServer = new MCPServer({
  name: 'マイMCPサーバー',
  agents: {
    myAgent,
  },
});
```

`MCPClient` の設定方法や、静的および動的な MCP サーバー構成の違いの詳細については、[MCP Overview](/docs/tools-mcp/mcp-overview) を参照してください。

## MCP リソースへのアクセス \{#accessing-mcp-resources\}

ツールに加えて、MCP サーバーはアプリケーションで取得して利用できるデータやコンテンツといったリソースを公開することもできます。

```typescript filename="src/mastra/resources.ts" {3-8}
import { mcp } from './mcp';

// 接続されているすべてのMCPサーバーからリソースを取得
const resources = await mcp.getResources();

// 特定のサーバーからリソースにアクセス
if (resources.filesystem) {
  const resource = resources.filesystem.find(r => r.uri === 'filesystem://Downloads');
  console.log(`リソース: ${resource?.name}`);
}
```

各リソースには URI、名前、説明、MIME タイプがあります。`getResources()` メソッドはエラーを適切に処理し、サーバーがエラーになった場合やリソースをサポートしていない場合は、そのサーバーは結果から除外されます。

## MCP のプロンプトにアクセスする \{#accessing-mcp-prompts\}

MCP サーバーはプロンプトも公開でき、これはエージェント向けの構造化されたメッセージ テンプレートや会話コンテキストを表します。

### プロンプト一覧 \{#listing-prompts\}

```typescript filename="src/mastra/prompts.ts"
import { mcp } from './mcp';

// 接続されているすべてのMCPサーバーからプロンプトを取得
const prompts = await mcp.prompts.list();

// 特定のサーバーからプロンプトにアクセス
if (prompts.weather) {
  const prompt = prompts.weather.find(p => p.name === 'current');
  console.log(`プロンプト: ${prompt?.name}`);
}
```

各プロンプトには、名前、説明、（任意で）バージョンがあります。

### プロンプトとそのメッセージの取得 \{#retrieving-a-prompt-and-its-messages\}

```typescript filename="src/mastra/prompts.ts"
const { prompt, messages } = await mcp.prompts.get({ serverName: 'weather', name: 'current' });
console.log(prompt); // { name: "current", version: "v1", ... }
console.log(messages); // [ { role: "assistant", content: { type: "text", text: "..." } }, ... ]
```

## `MCPServer` を介してエージェントをツールとして公開する \{#exposing-agents-as-tools-via-mcpserver\}

MCP サーバーのツールを利用するだけでなく、Mastra の `MCPServer` を使えば、Mastra Agents 自体を MCP 互換クライアント向けのツールとして公開できます。

`MCPServer` の設定に `Agent` インスタンスを指定すると、以下のように動作します:

* 自動的に呼び出し可能なツールに変換されます。
* ツール名は `ask_<agentKey>` となり、`<agentKey>` は `MCPServer` の `agents` 設定にエージェントを追加する際に使用した識別子です。
* エージェントの `description` プロパティ（空でない文字列である必要があります）が、ツールの説明文として使用されます。

これにより、他の AI モデルや MCP クライアントは、標準的なツールと同様に、通常は「質問する」形であなたの Mastra Agents とやり取りできます。

**エージェントを含む `MCPServer` の設定例:**

```typescript filename="src/mastra/mcp.ts"
import { Agent } from '@mastra/core/agent';
import { MCPServer } from '@mastra/mcp';
import { openai } from '@ai-sdk/openai';
import { weatherInfo } from '../tools/weatherInfo';
import { generalHelper } from '../agents/generalHelper';

const server = new MCPServer({
  name: 'エージェントツール対応のカスタムサーバー',
  version: '1.0.0',
  tools: {
    weatherInfo,
  },
  agents: { generalHelper }, // 「ask_generalHelper」ツールを公開
});
```

`MCPServer` でエージェントをツールに正しく変換するには、コンストラクターの設定で `description` プロパティを空ではない文字列に設定する必要があります。`description` が未設定または空の場合、初期化時に `MCPServer` はエラーをスローします。

`MCPServer` のセットアップと構成の詳細については、[MCPServer リファレンスドキュメント](/docs/reference/tools/mcp-server) を参照してください。

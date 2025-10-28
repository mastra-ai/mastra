---
title: "リファレンス: MCPServer"
description: MCPServer の API リファレンス — Mastra のツールや機能を Model Context Protocol サーバーとして公開するクラス。
---

# MCPServer \{#mcpserver\}

`MCPServer` クラスは、既存の Mastra のツールやエージェントを Model Context Protocol（MCP）サーバーとして公開する機能を提供します。これにより、任意の MCP クライアント（Cursor、Windsurf、Claude Desktop など）がこれらの機能に接続し、エージェントで利用できるようになります。

ツールやエージェントを Mastra アプリケーション内で直接使うだけなら、必ずしも MCP サーバーを作成する必要はありません。この API は、Mastra のツールやエージェントを「外部」の MCP クライアントに公開するためのものです。

[stdio（サブプロセス）および SSE（HTTP）の MCP トランスポート](https://modelcontextprotocol.io/docs/concepts/transports) の両方をサポートしています。

## コンストラクター \{#constructor\}

新しい `MCPServer` を作成するには、サーバーの基本情報、提供するツール、そして必要に応じてツールとして公開したいエージェントを指定します。

```typescript
import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { MCPServer } from "@mastra/mcp";
import { z } from "zod";
import { dataProcessingWorkflow } from "../workflows/dataProcessingWorkflow";

const myAgent = new Agent({
  name: "MyExampleAgent",
  description: "基本的な質問に対応する汎用エージェント。"
  instructions: "あなたは親切なアシスタントです。",
  model: openai("gpt-4o-mini"),
});

const weatherTool = createTool({
  id: "getWeather",
  description: "Gets the current weather for a location.",
  inputSchema: z.object({ location: z.string() }),
  execute: async ({ context }) => `${context.location}の天気は晴れです。`,
});

const server = new MCPServer({
  name: "My Custom Server",
  version: "1.0.0",
  tools: { weatherTool },
  agents: { myAgent }, // このエージェントはツール "ask_myAgent" になります
  workflows: {
    dataProcessingWorkflow, // このワークフローはツール "run_dataProcessingWorkflow" になります
  }
});
```

### 構成プロパティ \{#configuration-properties\}

コンストラクターは、以下のプロパティを持つ `MCPServerConfig` オブジェクトを受け取ります:

<PropertiesTable
  content={[
{
name: "name",
type: "string",
isOptional: false,
description:
"サーバーのわかりやすい名前（例: 'My Weather and Agent Server'）。",
},
{
name: "version",
type: "string",
isOptional: false,
description: "サーバーのセマンティック バージョン（例: '1.0.0'）。",
},
{
name: "tools",
type: "ToolsInput",
isOptional: false,
description:
"キーがツール名、値が Mastra のツール定義（`createTool` または Vercel AI SDK で作成）であるオブジェクト。これらのツールはそのまま公開されます。",
},
{
name: "agents",
type: "Record<string, Agent>",
isOptional: true,
description:
"キーがエージェント識別子、値が Mastra Agent インスタンスであるオブジェクト。各エージェントは自動的に `ask_<agentIdentifier>` という名前のツールに変換されます。エージェントはコンストラクター設定で空でない `description` 文字列プロパティを定義している必要があります。この説明はツールの説明として使用されます。エージェントの説明がない、または空の場合、MCPServer の初期化時にエラーが発生します。",
},
{
name: "workflows",
type: "Record<string, Workflow>",
isOptional: true,
description:
"キーがワークフロー識別子、値が Mastra Workflow インスタンスであるオブジェクト。各ワークフローは `run_<workflowKey>` という名前のツールに変換されます。ワークフローの `inputSchema` はツールの入力スキーマになります。ワークフローは空でない `description` 文字列プロパティを持っている必要があり、これはツールの説明として使用されます。ワークフローの説明がない、または空の場合はエラーになります。ツールは `workflow.createRunAsync()` を呼び出し、続いて `run.start({ inputData: <tool_input> })` を実行してワークフローを実行します。エージェントやワークフローから派生したツール名（例: `ask_myAgent`、`run_myWorkflow`）が、明示的に定義されたツール名や別の派生名と衝突する場合は、明示的に定義されたツールが優先され、警告がログに記録されます。以降の衝突を引き起こすエージェント/ワークフローはスキップされます。",
},
{
name: "id",
type: "string",
isOptional: true,
description:
"サーバーの任意の一意な識別子。指定しない場合は UUID が生成されます。この ID は確定値で、指定された場合は Mastra によって変更されません。",
},
{
name: "description",
type: "string",
isOptional: true,
description: "MCP サーバーの機能についての任意の説明。",
},
{
name: "repository",
type: "Repository", // { url: string; source: string; id: string; }
isOptional: true,
description:
"サーバーのソースコードのリポジトリ情報（任意）。",
},
{
name: "releaseDate",
type: "string", // ISO 8601
isOptional: true,
description:
"このサーバー バージョンのリリース日（ISO 8601 文字列、任意）。指定しない場合はインスタンス化時刻が既定となります。",
},
{
name: "isLatest",
type: "boolean",
isOptional: true,
description:
"これが最新バージョンであるかを示すフラグ（任意）。指定しない場合は true が既定です。",
},
{
name: "packageCanonical",
type: "'npm' | 'docker' | 'pypi' | 'crates' | string",
isOptional: true,
description:
"サーバーをパッケージとして配布する場合の正準パッケージ形式（任意。例: 'npm'、'docker'）。",
},
{
name: "packages",
type: "PackageInfo[]",
isOptional: true,
description: "このサーバー向けのインストール可能なパッケージ一覧（任意）。",
},
{
name: "remotes",
type: "RemoteInfo[]",
isOptional: true,
description: "このサーバーへのリモートアクセスポイントの一覧（任意）。",
},
{
name: "resources",
type: "MCPServerResources",
isOptional: true,
description:
"サーバーが MCP リソースをどのように扱うかを定義するオブジェクト。詳細は「Resource Handling」セクションを参照してください。",
},
{
name: "prompts",
type: "MCPServerPrompts",
isOptional: true,
description:
"サーバーが MCP プロンプトをどのように扱うかを定義するオブジェクト。詳細は「Prompt Handling」セクションを参照してください。",
},
]}
/>

## ツールとしてエージェントを公開する \{#exposing-agents-as-tools\}

`MCPServer` の強力な機能の一つに、Mastra エージェントを自動的に呼び出し可能なツールとして公開できる点があります。設定の `agents` プロパティにエージェントを指定すると:

* **ツールの命名**: 各エージェントは `ask_<agentKey>` という名前のツールに変換されます。ここでの `<agentKey>` は、`agents` オブジェクト内でそのエージェントに割り当てたキーです。例えば `agents: { myAgentKey: myAgentInstance }` と設定すると、`ask_myAgentKey` というツールが作成されます。

* **ツールの機能**:
  * **説明**: 生成されるツールの説明は次の形式になります: &quot;エージェント `<AgentName>` に質問します。元のエージェントの指示: `<agent description>`&quot;
  * **入力**: ツールは `message` プロパティ（文字列）を持つ単一のオブジェクト引数を受け取ります: `{ message: "エージェントへの質問内容" }`。
  * **実行**: このツールが呼び出されると、対応するエージェントの `generate()` メソッドが、提供された `query` を渡して実行されます。
  * **出力**: エージェントの `generate()` メソッドの結果が、そのままツールの出力として返されます。

* **名前の衝突**: `tools` 設定で明示的に定義されたツールが、エージェント由来のツールと同名の場合（例: `ask_myAgentKey` というツールがあり、同時にキー `myAgentKey` のエージェントもある場合）、*明示的に定義されたツールが優先されます*。この衝突が発生した場合、そのエージェントはツールに変換されず、警告がログに記録されます。

これにより、MCP クライアントが他のツールと同様に、自然言語のクエリでエージェントとやり取りできるようになります。

### エージェントからツールへの変換 \{#agent-to-tool-conversion\}

`agents` 設定プロパティでエージェントを指定すると、`MCPServer` は各エージェントに対応するツールを自動的に作成します。ツール名は `ask_<agentIdentifier>` で、`<agentIdentifier>` は `agents` オブジェクトで使用したキーです。

生成されるツールの説明は次のとおりです: &quot;エージェント `<agent.name>` に質問します。エージェントの説明: `<agent.description>`&quot;。

重要: エージェントをツールに変換するには、インスタンス化時の設定で空でない `description` 文字列プロパティが設定されている必要があります（例: `new Agent({ name: 'myAgent', description: 'This agent does X.', ... })`）。`description` が欠落している、または空のエージェントが `MCPServer` に渡された場合、`MCPServer` のインスタンス化時にエラーがスローされ、サーバーのセットアップは失敗します。

これにより、エージェントの生成能力を MCP 経由で手早く公開でき、クライアントはエージェントに直接「質問」できるようになります。

## メソッド \{#methods\}

`MCPServer` インスタンスに対して呼び出し、動作を制御したり情報を取得したりできる関数です。

### startStdio() \{#startstdio\}

このメソッドは、標準入力・標準出力（stdio）で通信するサーバーを起動するために使用します。サーバーをコマンドラインのプログラムとして実行する場合によく使われます。

```typescript
async startStdio(): Promise<void>
```

stdio を使用してサーバーを起動する方法は次のとおりです。

```typescript
const server = new MCPServer({
  // 上記の設定例
});
await server.startStdio();
```

### startSSE() \{#startsse\}

このメソッドは、既存のウェブサーバーに MCP サーバーを統合し、通信に Server-Sent Events (SSE) を利用できるようにします。SSE またはメッセージのパスへのリクエストを受け取った際に、ウェブサーバー側のコードから呼び出します。

```typescript
async startSSE({
  url,
  ssePath,
  messagePath,
  req,
  res,
}: {
  url: URL;
  ssePath: string;
  messagePath: string;
  req: any;
  res: any;
}): Promise<void>
```

次の例は、HTTP サーバーのリクエストハンドラー内で `startSSE` を使用する方法を示しています。この例では、MCP クライアントが `http://localhost:1234/sse` の MCP サーバーに接続できます。

```typescript
import http from 'http';

const httpServer = http.createServer(async (req, res) => {
  await server.startSSE({
    url: new URL(req.url || '', `http://localhost:1234`),
    ssePath: '/sse',
    messagePath: '/message',
    req,
    res,
  });
});

httpServer.listen(PORT, () => {
  console.log(`HTTPサーバーがポート${PORT}で待機しています`);
});
```

`startSSE` メソッドに必要な値の詳細は次のとおりです。

<PropertiesTable
  content={[
{
name: "url",
type: "URL",
description: "ユーザーが要求しているウェブアドレス。",
},
{
name: "ssePath",
type: "string",
description:
"SSE 用にクライアントが接続する URL の特定部分（例: '/sse'）。",
},
{
name: "messagePath",
type: "string",
description:
"クライアントがメッセージを送信する URL の特定部分（例: '/message'）。",
},
{
name: "req",
type: "any",
description: "ウェブサーバーからの受信リクエストオブジェクト。",
},
{
name: "res",
type: "any",
description:
"データを返送するために使用する、ウェブサーバーのレスポンスオブジェクト。",
},
]}
/>

### startHonoSSE() \{#starthonosse\}

このメソッドは、既存のウェブサーバーとMCPサーバーを統合し、通信に Server-Sent Events（SSE）を利用できるようにするためのものです。SSE やメッセージ用のパスへのリクエストを受け取った際に、ウェブサーバー側のコードから呼び出してください。

```typescript
async startHonoSSE({
  url,
  ssePath,
  messagePath,
  req,
  res,
}: {
  url: URL;
  ssePath: string;
  messagePath: string;
  req: any;
  res: any;
}): Promise<void>
```

以下は、HTTP サーバーのリクエストハンドラー内で `startHonoSSE` を使用する例です。この例では、MCP クライアントが `http://localhost:1234/hono-sse` の MCP サーバーに接続できます。

```typescript
import http from 'http';

const httpServer = http.createServer(async (req, res) => {
  await server.startHonoSSE({
    url: new URL(req.url || '', `http://localhost:1234`),
    ssePath: '/hono-sse',
    messagePath: '/message',
    req,
    res,
  });
});

httpServer.listen(PORT, () => {
  console.log(`HTTPサーバーがポート${PORT}で待機しています`);
});
```

`startHonoSSE` メソッドに必要な値の詳細は次のとおりです：

<PropertiesTable
  content={[
{
name: "url",
type: "URL",
description: "ユーザーがリクエストしているウェブアドレス。",
},
{
name: "ssePath",
type: "string",
description:
"SSE の接続先となる URL の特定のパス（例：'/hono-sse'）。",
},
{
name: "messagePath",
type: "string",
description:
"クライアントがメッセージを送信する URL の特定のパス（例：'/message'）。",
},
{
name: "req",
type: "any",
description: "Web サーバーからの受信リクエストオブジェクト。",
},
{
name: "res",
type: "any",
description:
"データを返すために使用する、Web サーバーのレスポンスオブジェクト。",
},
]}
/>

### startHTTP() \{#starthttp\}

このメソッドは、通信にストリーミング対応の HTTP を用いるために、既存の Web サーバーと MCP サーバーを統合する際に役立ちます。HTTP リクエストを受信した際に、Web サーバー側のコードから呼び出してください。

```typescript
async startHTTP({
  url,
  httpPath,
  req,
  res,
  options = { sessionIdGenerator: () => randomUUID() },
}: {
  url: URL;
  httpPath: string;
  req: http.IncomingMessage;
  res: http.ServerResponse<http.IncomingMessage>;
  options?: StreamableHTTPServerTransportOptions;
}): Promise<void>
```

次の例は、HTTP サーバーのリクエストハンドラー内で `startHTTP` を使用する方法を示しています。この例では、MCP クライアントは `http://localhost:1234/http` の MCP サーバーに接続できます。

```typescript
import http from 'http';

const httpServer = http.createServer(async (req, res) => {
  await server.startHTTP({
    url: new URL(req.url || '', 'http://localhost:1234'),
    httpPath: `/mcp`,
    req,
    res,
    options: {
      sessionIdGenerator: undefined,
    },
  });
});

httpServer.listen(PORT, () => {
  console.log(`HTTPサーバーがポート${PORT}で待機しています`);
});
```

`startHTTP` メソッドに必要な値の詳細は次のとおりです。

<PropertiesTable
  content={[
{
name: 'url',
type: 'URL',
description: 'ユーザーがリクエストしている Web アドレス。',
},
{
name: 'httpPath',
type: 'string',
description:
"MCP サーバーが HTTP リクエストを処理する URL の特定のパス（例: '/mcp'）。",
},
{
name: 'req',
type: 'http.IncomingMessage',
description: 'Web サーバーからの受信リクエストオブジェクト。',
},
{
name: 'res',
type: 'http.ServerResponse',
description:
'Web サーバーからのレスポンスオブジェクト。データの送信に使用します。',
},
{
name: 'options',
type: 'StreamableHTTPServerTransportOptions',
description:
'HTTP トランスポートの任意設定。詳細は以下のオプション表を参照してください。',
optional: true,
},
]}
/>

`StreamableHTTPServerTransportOptions` オブジェクトを使用すると、HTTP トランスポートの動作をカスタマイズできます。利用可能なオプションは次のとおりです。

<PropertiesTable
  content={[
{
name: 'sessionIdGenerator',
type: '(() => string) | undefined',
description:
'一意のセッション ID を生成する関数。暗号学的に安全で、グローバルに一意な文字列である必要があります。セッション管理を無効にする場合は `undefined` を返します。',
},
{
name: 'onsessioninitialized',
type: '(sessionId: string) => void',
description:
'新しいセッションが初期化されたときに呼び出されるコールバック。アクティブな MCP セッションの追跡に役立ちます。',
optional: true,
},
{
name: 'enableJsonResponse',
type: 'boolean',
description:
'`true` の場合、サーバーはストリーミングに Server-Sent Events (SSE) を使用せず、プレーンな JSON レスポンスを返します。既定値は `false` です。',
optional: true,
},
{
name: 'eventStore',
type: 'EventStore',
description:
'メッセージ再開性のためのイベントストア。これを提供すると、クライアントは再接続してメッセージストリームを再開できます。',
optional: true,
},
]}
/>

### close() \{#close\}

このメソッドはサーバーを停止し、すべてのリソースを解放します。

```typescript
async close(): Promise<void>
```

### getServerInfo() \{#getserverinfo\}

このメソッドでサーバーの基本情報を参照できます。

```typescript
getServerInfo(): ServerInfo
```

### getServerDetail() \{#getserverdetail\}

このメソッドは、サーバーの詳細情報を取得できます。

```typescript
getServerDetail(): ServerDetail
```

### getToolListInfo() \{#gettoollistinfo\}

このメソッドは、サーバー作成時に設定されたツールの一覧を参照できます。読み取り専用のリストで、デバッグに役立ちます。

```typescript
getToolListInfo(): ToolListInfo
```

### getToolInfo() \{#gettoolinfo\}

このメソッドは、特定のツールに関する詳細情報を返します。

```typescript
getToolInfo(toolName: string): ToolInfo
```

### executeTool() \{#executetool\}

このメソッドは特定のツールを実行し、結果を返します。

```typescript
executeTool(toolName: string, input: any): Promise<any>
```

### getStdioTransport() \{#getstdiotransport\}

`startStdio()` でサーバーを起動した場合、stdio 通信を管理するオブジェクトを取得できます。これは主に内部的な確認やテストの目的で使用します。

```typescript
getStdioTransport(): StdioServerTransport | undefined
```

### getSseTransport() \{#getssetransport\}

`startSSE()` でサーバーを起動した場合、SSE 通信を管理するオブジェクトを取得できます。`getStdioTransport` と同様に、これは主に内部的な確認やテストのために使用します。

```typescript
getSseTransport(): SSEServerTransport | undefined
```

### getSseHonoTransport() \{#getssehonotransport\}

サーバーを `startHonoSSE()` で起動した場合、SSE 通信を管理するオブジェクトを取得するために使用できます。`getSseTransport` と同様に、主に内部確認やテスト用途向けです。

```typescript
getSseHonoTransport(): SSETransport | undefined
```

### getStreamableHTTPTransport() \{#getstreamablehttptransport\}

サーバーを `startHTTP()` で起動している場合、HTTP 通信を管理するオブジェクトを取得するために使用できます。`getSseTransport` と同様に、主に内部確認やテスト用途を想定しています。

```typescript
getStreamableHTTPTransport(): StreamableHTTPServerTransport | undefined
```

### tools() \{#tools\}

この MCP サーバーが提供する特定のツールを実行します。

```typescript
async executeTool(
  toolId: string,
  args: any,
  executionContext?: { messages?: any[]; toolCallId?: string },
): Promise<any>
```

<PropertiesTable
  content={[
{
name: "toolId",
type: "string",
description: "実行するツールのID／名前。",
},
{
name: "args",
type: "any",
description: "ツールのexecute関数に渡す引数。",
},
{
name: "executionContext",
type: "object",
isOptional: true,
description:
"メッセージやtoolCallIdなど、ツール実行用の任意のコンテキスト。",
},
]}
/>

## リソースの扱い \{#resource-handling\}

### MCP リソースとは？ \{#what-are-mcp-resources\}

リソースは Model Context Protocol (MCP) における基本的なプリミティブで、サーバーがデータやコンテンツを公開し、クライアントがそれを読み取って LLM とのやり取りのコンテキストとして利用できるようにします。MCP サーバーが提供したいあらゆる種類のデータを表し、たとえば次のようなものがあります:

* ファイルの内容
* データベースのレコード
* API レスポンス
* ライブなシステムデータ
* スクリーンショットや画像
* ログファイル

リソースは一意の URI（例: `file:///home/user/documents/report.pdf`, `postgres://database/customers/schema`）で識別され、テキスト（UTF-8 エンコード）またはバイナリデータ（base64 エンコード）を含むことができます。

クライアントは次の方法でリソースを取得できます:

1. **直接リソース**: サーバーは `resources/list` エンドポイントを通じて具体的なリソースの一覧を公開します。
2. **リソーステンプレート**: 動的なリソースについては、サーバーが URI テンプレート（RFC 6570）を公開し、クライアントはそれを用いてリソースの URI を構築します。

リソースを読み取るには、クライアントは対象の URI を指定して `resources/read` リクエストを送信します。クライアントがそのリソースをサブスクライブしている場合、サーバーはリソース一覧の変更（`notifications/resources/list_changed`）や特定のリソース内容の更新（`notifications/resources/updated`）を通知することもできます。

詳しくは、[MCP の公式ドキュメント（Resources）](https://modelcontextprotocol.io/docs/concepts/resources) を参照してください。

### `MCPServerResources` 型 \{#mcpserverresources-type\}

`resources` オプションには、`MCPServerResources` 型のオブジェクトを指定します。この型は、サーバーがリソースリクエストを処理するために使用するコールバックを定義します。

```typescript
export type MCPServerResources = {
  // 利用可能なリソースを一覧取得するためのコールバック
  listResources: () => Promise<Resource[]>;

  // 特定のリソースのコンテンツを取得するためのコールバック
  getResourceContent: ({ uri }: { uri: string }) => Promise<MCPServerResourceContent | MCPServerResourceContent[]>;

  // 利用可能なリソーステンプレートを一覧取得するための任意のコールバック
  resourceTemplates?: () => Promise<ResourceTemplate[]>;
};

export type MCPServerResourceContent = { text?: string } | { blob?: string };
```

例：

```typescript
import { MCPServer } from '@mastra/mcp';
import type { MCPServerResourceContent, Resource, ResourceTemplate } from '@mastra/mcp';

// リソースやリソーステンプレートは通常、動的に取得されます。
const myResources: Resource[] = [{ uri: 'file://data/123.txt', name: 'データファイル', mimeType: 'text/plain' }];

const myResourceContents: Record<string, MCPServerResourceContent> = {
  'file://data.txt/123': { text: 'これはデータファイルの内容です。' },
};

const myResourceTemplates: ResourceTemplate[] = [
  {
    uriTemplate: 'file://data/{id}',
    name: 'データファイル',
    description: 'データを含むファイルです。',
    mimeType: 'text/plain',
  },
];

const myResourceHandlers: MCPServerResources = {
  listResources: async () => myResources,
  getResourceContent: async ({ uri }) => {
    if (myResourceContents[uri]) {
      return myResourceContents[uri];
    }
    throw new Error(`リソースの内容が見つかりません: ${uri}`);
  },
  resourceTemplates: async () => myResourceTemplates,
};

const serverWithResources = new MCPServer({
  name: 'Resourceful Server',
  version: '1.0.0',
  tools: {
    /* ... your tools ... */
  },
  resources: myResourceHandlers,
});
```

### クライアントへのリソース変更の通知 \{#notifying-clients-of-resource-changes\}

利用可能なリソースやその内容が変更された場合、サーバーは当該リソースを購読している接続中のクライアントに通知できます。

#### `server.resources.notifyUpdated({ uri: string })` \{#serverresourcesnotifyupdated-uri-string\}

特定のリソース（`uri`で識別される）の内容が更新されたときに、このメソッドを呼び出します。このURIを購読しているクライアントがいる場合、`notifications/resources/updated` メッセージが送信されます。

```typescript
async server.resources.notifyUpdated({ uri: string }): Promise<void>
```

例：

```typescript
// 'file://data.txt' の内容を更新した後
await serverWithResources.resources.notifyUpdated({ uri: 'file://data.txt' });
```

#### `server.resources.notifyListChanged()` \{#serverresourcesnotifylistchanged\}

利用可能なリソースの一覧に変更があったとき（例：リソースが追加または削除された場合）にこのメソッドを呼び出します。これにより、クライアントに `notifications/resources/list_changed` メッセージが送信され、リソース一覧の再取得が促されます。

```typescript
async server.resources.notifyListChanged(): Promise<void>
```

例：

```typescript
// 'myResourceHandlers.listResources' で管理されているリソース一覧に新しいリソースを追加した後
await serverWithResources.resources.notifyListChanged();
```

## プロンプトの扱い \{#prompt-handling\}

### MCP プロンプトとは？ \{#what-are-mcp-prompts\}

プロンプトは、MCP サーバーがクライアントに提供する再利用可能なテンプレートまたはワークフローです。引数の受け渡し、リソースコンテキストの取り込み、バージョン管理のサポートが可能で、LLM とのやり取りの標準化に利用できます。

プロンプトは固有の名前（および任意のバージョン）で識別され、動的または静的に定義できます。

### `MCPServerPrompts` 型 \{#mcpserverprompts-type\}

`prompts` オプションは、`MCPServerPrompts` 型のオブジェクトを受け取ります。この型は、サーバーがプロンプトリクエストを処理するために用いるコールバックを定義します。

```typescript
export type MCPServerPrompts = {
  // 利用可能なプロンプトを一覧取得するためのコールバック
  listPrompts: () => Promise<Prompt[]>;

  // 特定のプロンプトのメッセージ／コンテンツを取得するためのコールバック
  getPromptMessages?: ({
    name,
    version,
    args,
  }: {
    name: string;
    version?: string;
    args?: any;
  }) => Promise<{ prompt: Prompt; messages: PromptMessage[] }>;
};
```

例：

```typescript
import { MCPServer } from '@mastra/mcp';
import type { Prompt, PromptMessage, MCPServerPrompts } from '@mastra/mcp';

const prompts: Prompt[] = [
  {
    name: 'analyze-code',
    description: 'コードの改善点を分析する',
    version: 'v1',
  },
  {
    name: 'analyze-code',
    description: 'コードの改善点を分析する（新しいロジック）',
    version: 'v2',
  },
];

const myPromptHandlers: MCPServerPrompts = {
  listPrompts: async () => prompts,
  getPromptMessages: async ({ name, version, args }) => {
    if (name === 'analyze-code') {
      if (version === 'v2') {
        const prompt = prompts.find(p => p.name === name && p.version === 'v2');
        if (!prompt) throw new Error('指定のプロンプトのバージョンが見つかりません'),
        return {
          prompt,
          messages: [
            {
              role: 'user',
              content: { type: 'text', text: `新しいロジックで次のコードを分析してください: ${args.code}` },
            },
          ],
        };
      }
      // Default or v1
      const prompt = prompts.find(p => p.name === name && p.version === 'v1');
      if (!prompt) throw new Error('指定のプロンプトのバージョンが見つかりません'),
      return {
        prompt,
        messages: [
          {
            role: 'user',
            content: { type: 'text', text: `次のコードを分析してください: ${args.code}` },
          },
        ],
      };
    }
    throw new Error('プロンプトが見つかりません'),
  },
};

const serverWithPrompts = new MCPServer({
  name: 'Promptful Server',
  version: '1.0.0',
  tools: {
    /* ... */
  },
  prompts: myPromptHandlers,
});
```

### プロンプト変更のクライアントへの通知 \{#notifying-clients-of-prompt-changes\}

利用可能なプロンプトが変更された場合、サーバーは接続しているクライアントに通知できます。

#### `server.prompts.notifyListChanged()` \{#serverpromptsnotifylistchanged\}

利用可能なプロンプトの一覧に変更があった場合（例：プロンプトの追加や削除）に、このメソッドを呼び出します。これにより、クライアントに `notifications/prompts/list_changed` メッセージが送信され、プロンプト一覧の再取得が促されます。

```typescript
await serverWithPrompts.prompts.notifyListChanged();
```

### プロンプト処理のベストプラクティス \{#best-practices-for-prompt-handling\}

* 明確で具体的なプロンプト名と説明を用いる。
* `getPromptMessages` で必須引数をすべて検証する。
* 破壊的変更が見込まれる場合は `version` フィールドを含める。
* 適切なプロンプトロジックを選択するために `version` パラメータを使用する。
* プロンプトの一覧が変更された場合はクライアントに通知する。
* エラーはわかりやすいメッセージで処理する。
* 引数の要件と利用可能なバージョンをドキュメント化する。

***

## 例 \{#examples\}

MCPServer のセットアップとデプロイの実用的な例については、[Deploying an MCPServer Example](/docs/examples/agents/deploying-mcp-server) を参照してください。

このページ冒頭の例では、ツールとエージェントの両方を使って `MCPServer` を初期化する方法も示しています。

## 叙述 \{#elicitation\}

### Elicitation とは？ \{#what-is-elicitation\}

Elicitation は Model Context Protocol (MCP) の機能で、サーバーがユーザーに構造化された情報をリクエストできるようにします。これにより、サーバーが動的に追加データを収集できるインタラクティブなワークフローが実現します。

`MCPServer` クラスには Elicitation 機能が自動的に含まれています。ツールは、ユーザー入力を要求するための `elicitation.sendRequest()` メソッドを含む `options` パラメータを、`execute` 関数で受け取ります。

### ツール実行シグネチャ \{#tool-execution-signature\}

ツールが MCP サーバーのコンテキスト内で実行される場合、追加の `options` パラメータが渡されます:

```typescript
execute: async ({ context }, options) => {
  // context にはツールの入力パラメータが含まれます
  // options には誘導（elicitation）や認証情報など、サーバーの機能が含まれます

  // 認証情報へアクセス（利用可能な場合）
  if (options.extra?.authInfo) {
    console.log('認証済みリクエストのクライアント ID:', options.extra.authInfo.clientId);
  }

  // 誘導（elicitation）機能を利用する
  const result = await options.elicitation.sendRequest({
    message: '情報をご提供ください',
    requestedSchema: {
      /* スキーマ */
    },
  });

  return result;
};
```

### 誘導（Elicitation）の仕組み \{#how-elicitation-works\}

一般的なユースケースはツールの実行中です。ツールがユーザー入力を必要とする場合、実行オプションで提供される誘導機能を利用できます:

1. ツールはメッセージとスキーマを指定して `options.elicitation.sendRequest()` を呼び出す
2. リクエストが接続中の MCP クライアントに送信される
3. クライアントがユーザーにリクエストを提示する（UI、コマンドラインなど）
4. ユーザーが入力する、辞退する、またはリクエストをキャンセルする
5. クライアントがレスポンスをサーバーに送信する
6. ツールがレスポンスを受け取り、処理を続行する

### ツールにおけるエリシテーションの活用 \{#using-elicitation-in-tools\}

以下は、ユーザーの連絡先情報を収集するためにエリシテーションを用いるツールの例です。

```typescript
import { MCPServer } from '@mastra/mcp';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const server = new MCPServer({
  name: 'インタラクティブ・サーバー',
  version: '1.0.0',
  tools: {
    collectContactInfo: createTool({
      id: 'collectContactInfo',
      description: 'エリシテーションを通じてユーザーの連絡先情報を収集します',
      inputSchema: z.object({
        reason: z.string().optional().describe('連絡先情報を収集する理由'),
      }),
      execute: async ({ context }, options) => {
        const { reason } = context;

        // Log session info if available
        console.log('セッションからのリクエスト:', options.extra?.sessionId);

        try {
          // Request user input via elicitation
          const result = await options.elicitation.sendRequest({
            message: reason
              ? `連絡先情報をご提供ください。${reason}`
              : '連絡先情報をご提供ください',
            requestedSchema: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  title: '氏名',
                  description: 'フルネーム',
                },
                email: {
                  type: 'string',
                  title: 'メールアドレス',
                  description: 'メールアドレス',
                  format: 'email',
                },
                phone: {
                  type: 'string',
                  title: '電話番号',
                  description: '電話番号（任意）',
                },
              },
              required: ['name', 'email'],
            },
          });

          // ユーザーの応答を処理
          if (result.action === 'accept') {
            return `連絡先情報を収集しました: ${JSON.stringify(result.content, null, 2)}`;
          } else if (result.action === 'decline') {
            return '連絡先情報の収集はユーザーに拒否されました。';
          } else {
            return '連絡先情報の収集はユーザーによりキャンセルされました。';
          }
        } catch (error) {
          return `連絡先情報の収集中にエラーが発生しました: ${error}`;
        }
      },
    }),
  },
});
```

### 取得リクエスト用スキーマ \{#elicitation-request-schema\}

`requestedSchema` はプリミティブなプロパティのみを持つフラットなオブジェクトである必要があります。サポートされる型は次のとおりです：

* **String**: `{ type: 'string', title: 'Display Name', description: 'Help text' }`
* **Number**: `{ type: 'number', minimum: 0, maximum: 100 }`
* **Boolean**: `{ type: 'boolean', default: false }`
* **Enum**: `{ type: 'string', enum: ['option1', 'option2'] }`

スキーマ例：

```typescript
{
  type: 'object',
  properties: {
    name: {
      type: 'string',
      title: '氏名（フルネーム）',
      description: '氏名（フルネーム）を入力してください',
    },
    age: {
      type: 'number',
      title: '年齢',
      minimum: 18,
      maximum: 120,
    },
    newsletter: {
      type: 'boolean',
      title: 'ニュースレターを購読する',
      default: false,
    },
  },
  required: ['name'],
}
```

### 応答アクション \{#response-actions\}

ユーザーは情報提示（エリシテーション）リクエストに対して、次の3通りで応答できます:

1. **Accept** (`action: 'accept'`): ユーザーがデータを提供し、送信を確定した
   * 提供したデータを含む `content` フィールドがある
2. **Decline** (`action: 'decline'`): ユーザーが情報提供を明確に拒否した
   * `content` フィールドはない
3. **Cancel** (`action: 'cancel'`): ユーザーが決定せずにリクエストを閉じた
   * `content` フィールドはない

ツールは、これら3種類の応答をすべて適切に処理する必要があります。

### セキュリティに関する考慮事項 \{#security-considerations\}

* **パスワード、マイナンバー、クレジットカード番号**などの機密情報を決して要求しない
* すべてのユーザー入力を提供されたスキーマに基づいて検証する
* 辞退やキャンセルを丁寧かつ円滑に処理する
* データ収集の目的を明確に説明する
* ユーザーのプライバシーと設定・選好を尊重する

### ツール実行 API \{#tool-execution-api\}

エリシテーション機能は、ツール実行の `options` パラメータで利用できます。

```typescript
// ツールの execute 関数内
execute: async ({ context }, options) => {
  // ユーザー入力にエリシテーションを使用する
  const result = await options.elicitation.sendRequest({
    message: string,           // ユーザーに表示するメッセージ
    requestedSchema: object    // 期待される応答の構造を定義する JSON スキーマ
  }): Promise<ElicitResult>

  // 必要に応じて認証情報にアクセスする
  if (options.extra?.authInfo) {
    // options.extra.authInfo.token などを使用する
  }
}
```

HTTP ベースのトランスポート（SSE または HTTP）を使用する場合、elicitation は**セッション認識**であることに注意してください。つまり、複数のクライアントが同じサーバーに接続している場合でも、elicitation リクエストはツール実行を開始した該当のクライアントセッションに正しくルーティングされます。

`ElicitResult` 型:

```typescript
type ElicitResult = {
  action: 'accept' | 'decline' | 'cancel';
  content?: any; // action が 'accept' の場合にのみ存在します
};
```

## 認証コンテキスト \{#authentication-context\}

HTTP ベースのトランスポートを使用する場合、ツールは `options.extra` からリクエストのメタデータにアクセスできます。

```typescript
execute: async ({ context }, options) => {
  if (!options.extra?.authInfo?.token) {
    return '認証が必要です';
  }

  // 認証トークンを使用する
  const response = await fetch('/api/data', {
    headers: { Authorization: `Bearer ${options.extra.authInfo.token}` },
    signal: options.extra.signal,
  });

  return response.json();
};
```

`extra` オブジェクトには以下が含まれます:

* `authInfo`: 認証情報（サーバーのミドルウェアが提供する場合）
* `sessionId`: セッション ID
* `signal`: 取り消し用の AbortSignal
* `sendNotification`/`sendRequest`: MCP プロトコル関数

> 注: 認証を有効化するには、`server.startHTTP()` を呼び出す前に `req.auth` を設定するミドルウェアを HTTP サーバーに組み込む必要があります。例:
>
> ```typescript
> httpServer.createServer((req, res) => {
>   // 認証ミドルウェアを追加
>   req.auth = validateAuthToken(req.headers.authorization);
>
>   // その後、MCP サーバーへ渡す
>   await server.startHTTP({ url, httpPath, req, res });
> });
> ```

## 関連情報 \{#related-information\}

* Mastra で MCP サーバーに接続する方法については、[MCPClient のドキュメント](./mcp-client)をご覧ください。
* Model Context Protocol について詳しくは、[@modelcontextprotocol/sdk のドキュメント](https://github.com/modelcontextprotocol/typescript-sdk)をご参照ください。
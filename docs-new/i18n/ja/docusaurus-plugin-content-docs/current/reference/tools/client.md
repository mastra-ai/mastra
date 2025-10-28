---
title: "リファレンス: MastraMCPClient"
description: MastraMCPClient の API リファレンス — Model Context Protocol 用クライアント実装。
---

# MastraMCPClient（非推奨） \{#mastramcpclient-deprecated\}

`MastraMCPClient` クラスは、Model Context Protocol（MCP）サーバーとやり取りするためのクライアント実装を提供します。MCPを通じて、接続管理、リソースの発見、ツールの実行を行います。

## 非推奨のお知らせ \{#deprecation-notice\}

`MastraMCPClient` は今後、[`MCPClient`](./mcp-client) に統合され、非推奨となります。単一の MCP サーバー用と複数の MCP サーバー用に別々のインターフェースを用意するのではなく、単一の MCP サーバーを使用する場合でも、複数を管理できるインターフェースの使用を推奨します。

## コンストラクター \{#constructor\}

MastraMCPClient の新しいインスタンスを生成します。

```typescript
constructor({
    name,
    version = '1.0.0',
    server,
    capabilities = {},
    timeout = 60000,
}: {
    name: string;
    server: MastraMCPServerDefinition;
    capabilities?: ClientCapabilities;
    version?: string;
    timeout?: number;
})
```

### パラメータ \{#parameters\}

<br />

<PropertiesTable
  content={[
  {
    name: "name",
    type: "string",
    description: "このクライアントインスタンスの名前（識別子）。",
  },
  {
    name: "version",
    type: "string",
    isOptional: true,
    defaultValue: "1.0.0",
    description: "クライアントのバージョン。",
  },
  {
    name: "server",
    type: "MastraMCPServerDefinition",
    description:
      "stdio サーバー接続または SSE サーバー接続の設定パラメータ。ログハンドラーやサーバーログの設定を含めることができます。",
  },
  {
    name: "capabilities",
    type: "ClientCapabilities",
    isOptional: true,
    defaultValue: "{}",
    description: "クライアントの任意の機能設定。",
  },
  {
    name: "timeout",
    type: "number",
    isOptional: true,
    defaultValue: 60000,
    description:
      "クライアントによるツール呼び出しのタイムアウト時間（ミリ秒）。",
  },
]}
/>

### MastraMCPServerDefinition \{#mastramcpserverdefinition\}

この定義を使ってMCPサーバーを構成できます。クライアントは、指定されたパラメータに基づいてトランスポート方式を自動判別します。

* `command` が指定されている場合は、Stdio トランスポートを使用します。
* `url` が指定されている場合は、まず Streamable HTTP トランスポートを試み、初回接続に失敗した場合は従来の SSE トランスポートにフォールバックします。

<br />

<PropertiesTable
  content={[
  {
    name: "command",
    type: "string",
    isOptional: true,
    description: "Stdio サーバー向け: 実行するコマンド。",
  },
  {
    name: "args",
    type: "string[]",
    isOptional: true,
    description: "Stdio サーバー向け: コマンドに渡す引数。",
  },
  {
    name: "env",
    type: "Record<string, string>",
    isOptional: true,
    description:
      "Stdio サーバー向け: コマンドに設定する環境変数。",
  },
  {
    name: "url",
    type: "URL",
    isOptional: true,
    description:
      "HTTP サーバー（Streamable HTTP または SSE）向け: サーバーの URL。",
  },
  {
    name: "requestInit",
    type: "RequestInit",
    isOptional: true,
    description: "HTTP サーバー向け: fetch API のリクエスト設定。",
  },
  {
    name: "eventSourceInit",
    type: "EventSourceInit",
    isOptional: true,
    description:
      "SSE フォールバック向け: SSE 接続用のカスタム fetch 設定。SSE でカスタムヘッダーを使用する場合に必須。",
  },
  {
    name: "logger",
    type: "LogHandler",
    isOptional: true,
    description: "ログ出力用の追加ハンドラー（任意）。",
  },
  {
    name: "timeout",
    type: "number",
    isOptional: true,
    description: "サーバー固有のタイムアウト（ミリ秒）。",
  },
  {
    name: "capabilities",
    type: "ClientCapabilities",
    isOptional: true,
    description: "サーバー固有の機能設定。",
  },
  {
    name: "enableServerLogs",
    type: "boolean",
    isOptional: true,
    defaultValue: "true",
    description: "このサーバーのログを有効にするかどうか。",
  },
]}
/>

### LogHandler \{#loghandler\}

`LogHandler` 関数は `LogMessage` オブジェクトを引数に取り、void を返します。`LogMessage` オブジェクトには次のプロパティがあります。`LoggingLevel` 型は文字列の列挙体で、値は `debug`、`info`、`warn`、`error` です。

<br />

<PropertiesTable
  content={[
  {
    name: "level",
    type: "LoggingLevel",
    description: "ログレベル（debug、info、warn、error）",
  },
  {
    name: "message",
    type: "string",
    description: "ログメッセージの内容",
  },
  {
    name: "timestamp",
    type: "Date",
    description: "ログが生成された時刻",
  },
  {
    name: "serverName",
    type: "string",
    description: "ログを生成したサーバー名",
  },
  {
    name: "details",
    type: "Record<string, any>",
    isOptional: true,
    description: "任意の追加のログ詳細",
  },
]}
/>

## 手法 \{#methods\}

### connect() \{#connect\}

MCP サーバーに接続します。

```typescript
async connect(): Promise<void>
```

### disconnect() \{#disconnect\}

MCP サーバーとの接続を切断します。

```typescript
async disconnect(): Promise<void>
```

### resources() \{#resources\}

サーバーから利用可能なリソースのリストを取得します。

```typescript
async resources(): Promise<ListResourcesResult>
```

### tools() \{#tools\}

サーバーから利用可能なツールを取得して初期化し、Mastra 互換のツール形式に変換します。

```typescript
async tools(): Promise<Record<string, Tool>>
```

ツール名を対応する Mastra のツール実装へマップしたオブジェクトを返します。

## 例 \{#examples\}

### Mastra Agent と併用する \{#using-with-mastra-agent\}

#### Stdio サーバーの例 \{#example-with-stdio-server\}

```typescript
import { Agent } from '@mastra/core/agent';
import { MastraMCPClient } from '@mastra/mcp';
import { openai } from '@ai-sdk/openai';

// 例として mcp/fetch を使って MCP クライアントを初期化します https://hub.docker.com/r/mcp/fetch
// 他の参考用 Docker MCP サーバーについては https://github.com/docker/mcp-servers を参照してください
const fetchClient = new MastraMCPClient({
  name: 'fetch',
  server: {
    command: 'docker',
    args: ['run', '-i', '--rm', 'mcp/fetch'],
    logger: logMessage => {
      console.log(`[${logMessage.level}] ${logMessage.message}`);
    },
  },
});

// Mastra エージェントを作成
const agent = new Agent({
  name: 'Fetch agent',
  instructions: '必要に応じて URL からデータを取得し、ユーザーとレスポンスデータについて議論できます。',
  model: openai('gpt-4o-mini'),
});

try {
  // MCP サーバーに接続
  await fetchClient.connect();

  // プロセス終了時に適切に処理して、Docker のサブプロセスをクリーンアップします
  process.on('exit', () => {
    fetchClient.disconnect();
  });

  // 利用可能なツールを取得
  const tools = await fetchClient.tools();

  // MCP ツールを使ってエージェントを利用
  const response = await agent.generate(
    'mastra.ai/docs について教えてください。このページの概要と、含まれている内容を大まかに教えてください。',
    {
      toolsets: {
        fetch: tools,
      },
    },
  );

  console.log('\n\n' + response.text);
} catch (error) {
  console.error('エラー:', error);
} finally {
  // 終了時は必ず切断する
  await fetchClient.disconnect();
}
```

### SSE サーバーの例 \{#example-with-sse-server\}

```typescript
// SSE サーバーを使って MCP クライアントを初期化する
const sseClient = new MastraMCPClient({
  name: 'sse-client',
  server: {
    url: new URL('https://your-mcp-server.com/sse'),
    // 任意の fetch リクエスト設定 - 注意: SSE では requestInit だけでは不十分
    requestInit: {
      headers: {
        Authorization: 'Bearer your-token',
      },
    },
    // カスタムヘッダー付きの SSE 接続で必須
    eventSourceInit: {
      fetch(input: Request | URL | string, init?: RequestInit) {
        const headers = new Headers(init?.headers || {});
        headers.set('Authorization', 'Bearer your-token');
        return fetch(input, {
          ...init,
          headers,
        });
      },
    },
    // 任意の追加ロギング設定
    logger: logMessage => {
      console.log(`[${logMessage.level}] ${logMessage.serverName}: ${logMessage.message}`);
    },
    // サーバーログを無効化
    enableServerLogs: false,
  },
});

// 以降の利用方法は stdio の例と同じ
```

### SSE 認証に関する重要な注意事項 \{#important-note-about-sse-authentication\}

認証やカスタムヘッダーを伴う SSE 接続を使用する場合は、`requestInit` と `eventSourceInit` の両方を設定する必要があります。これは、SSE 接続がブラウザの EventSource API を利用しており、カスタムヘッダーを直接サポートしていないためです。

`eventSourceInit` を設定すると、SSE 接続で使われる内部の fetch リクエストをカスタマイズでき、認証ヘッダーを確実に含められます。
`eventSourceInit` を指定しない場合、`requestInit` に記述した認証ヘッダーは接続リクエストに含まれず、401 Unauthorized エラーにつながります。

## 関連情報 \{#related-information\}

* アプリケーションで複数の MCP サーバーを管理する方法については、[MCPClient ドキュメント](./mcp-client)を参照してください
* Model Context Protocol の詳細については、[@modelcontextprotocol/sdk ドキュメント](https://github.com/modelcontextprotocol/typescript-sdk)を参照してください。
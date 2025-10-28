---
title: "リファレンス: MCPClient"
description: MCPClient のAPIリファレンス — 複数のModel Context Protocolサーバーとそのツールを管理するクラス。
---

# MCPClient \{#mcpclient\}

`MCPClient` クラスは、Mastra アプリケーションで複数の MCP サーバー接続とそれらのツールを一元管理するための仕組みを提供します。接続のライフサイクル管理やツールの名前空間化を担い、設定済みのすべてのサーバーにまたがるツールへのアクセスを可能にします。

このクラスは、非推奨となった [`MastraMCPClient`](/docs/reference/tools/client) の後継です。

## コンストラクター \{#constructor\}

MCPClient クラスの新しいインスタンスを生成します。

```typescript
constructor({
  id?: string;
  servers: Record<string, MastraMCPServerDefinition>;
  timeout?: number;
}: MCPClientOptions)
```

### MCPClientOptions \{#mcpclientoptions\}

<br />

<PropertiesTable
  content={[
  {
    name: "id",
    type: "string",
    isOptional: true,
    description:
      "この構成インスタンスの任意指定の一意な識別子。同一の構成で複数インスタンスを作成する際のメモリリークを防ぐために使用します。",
  },
  {
    name: "servers",
    type: "Record<string, MastraMCPServerDefinition>",
    description:
      "サーバー構成のマップ。各キーは一意のサーバー識別子で、値はそのサーバーの構成です。",
  },
  {
    name: "timeout",
    type: "number",
    isOptional: true,
    defaultValue: "60000",
    description:
      "個別のサーバー構成で上書きされない限り、すべてのサーバーに適用されるグローバルなタイムアウト値（ミリ秒）。",
  },
]}
/>

### MastraMCPServerDefinition \{#mastramcpserverdefinition\}

`servers` マップ内の各サーバーは `MastraMCPServerDefinition` 型で設定します。トランスポート方式は、指定されたパラメータに基づいて自動判別されます:

* `command` が指定されている場合は Stdio トランスポートを使用します。
* `url` が指定されている場合は、まず Streamable HTTP トランスポートを試し、初回の接続に失敗した場合はレガシーな SSE トランスポートにフォールバックします。

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
      "HTTP サーバー向け（Streamable HTTP または SSE）: サーバーの URL。",
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
      "SSE フォールバック用: SSE 接続のためのカスタム fetch 設定。SSE でカスタムヘッダーを使用する場合は必須。",
  },
  {
    name: "logger",
    type: "LogHandler",
    isOptional: true,
    description: "追加のログ出力ハンドラー（任意）。",
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

## メソッド \{#methods\}

### getTools() \{#gettools\}

構成済みのすべてのサーバーからツールを取得します。競合を防ぐため、ツール名はサーバー名で名前空間化され（形式は `serverName_toolName`）、サーバー名が先頭に付与されます。
Agent の定義に渡すことを想定しています。

```ts
new Agent({ tools: await mcp.getTools() });
```

### getToolsets() \{#gettoolsets\}

名前空間付きツール名（`serverName.toolName` 形式）を、それぞれのツール実装に対応付けたオブジェクトを返します。
generate または stream メソッドに動的に渡すことを想定しています。

```typescript
const res = await agent.stream(prompt, {
  toolsets: await mcp.getToolsets(),
});
```

### disconnect() \{#disconnect\}

すべてのMCPサーバーから切断し、リソースを解放します。

```typescript
async disconnect(): Promise<void>
```

### `resources` プロパティ \{#resources-property\}

`MCPClient` インスタンスには、リソース関連の操作にアクセスするための `resources` プロパティがあります。

```typescript
const mcpClient = new MCPClient({
  /* ...servers configuration... */
});

// mcpClient.resources 経由でリソースメソッドにアクセス
const allResourcesByServer = await mcpClient.resources.list();
const templatesByServer = await mcpClient.resources.templates();
// ... 他のリソースメソッドも同様
```

#### `resources.list()` \{#resourceslist\}

接続済みのすべての MCP サーバーから、利用可能なリソースをサーバー名ごとにまとめて取得します。

```typescript
async list(): Promise<Record<string, Resource[]>>
```

例：

```typescript
const resourcesByServer = await mcpClient.resources.list();
for (const serverName in resourcesByServer) {
  console.log(`${serverName} のリソース:`, resourcesByServer[serverName]);
}
```

#### `resources.templates()` \{#resourcestemplates\}

接続中のすべての MCP サーバーから、利用可能なリソーステンプレートをサーバー名ごとに取得します。

```typescript
async templates(): Promise<Record<string, ResourceTemplate[]>>
```

例：

```typescript
const templatesByServer = await mcpClient.resources.templates();
for (const serverName in templatesByServer) {
  console.log(`${serverName} のテンプレート:`, templatesByServer[serverName]);
}
```

#### `resources.read(serverName: string, uri: string)` \{#resourcesreadservername-string-uri-string\}

指定されたサーバーから、特定のリソースの内容を読み込みます。

```typescript
async read(serverName: string, uri: string): Promise<ReadResourceResult>
```

* `serverName`: サーバーの識別子（`servers` コンストラクターオプションで使用されるキー）。
* `uri`: 読み取るリソースの URI。

例：

```typescript
const content = await mcpClient.resources.read('myWeatherServer', 'weather://current');
console.log('現在の天気：', content.contents[0].text);
```

#### `resources.subscribe(serverName: string, uri: string)` \{#resourcessubscribeservername-string-uri-string\}

指定されたサーバー上の特定のリソースの更新を購読します。

```typescript
async subscribe(serverName: string, uri: string): Promise<object>
```

例：

```typescript
await mcpClient.resources.subscribe('myWeatherServer', 'weather://current');
```

#### `resources.unsubscribe(serverName: string, uri: string)` \{#resourcesunsubscribeservername-string-uri-string\}

指定したサーバー上の特定のリソースの更新購読を解除します。

```typescript
非同期 unsubscribe(serverName: string, uri: string): Promise<object>
```

例：

```typescript
await mcpClient.resources.unsubscribe('myWeatherServer', 'weather://current');
```

#### `resources.onUpdated(serverName: string, handler: (params: { uri: string }) => void)` \{#resourcesonupdatedservername-string-handler-params-uri-string-void\}

指定したサーバー上の購読中のリソースが更新された際に呼び出される通知ハンドラーを設定します。

```typescript
async onUpdated(serverName: string, handler: (params: { uri: string }) => void): Promise<void>
```

例：

```typescript
mcpClient.resources.onUpdated('myWeatherServer', params => {
  console.log(`myWeatherServer のリソースが更新されました: ${params.uri}`);
  // 必要に応じてここでリソースの内容を再取得します
  // await mcpClient.resources.read("myWeatherServer", params.uri);
});
```

#### `resources.onListChanged(serverName: string, handler: () => void)` \{#resourcesonlistchangedservername-string-handler-void\}

特定のサーバーで利用可能なリソースの一覧が変更された際に呼び出される通知ハンドラーを設定します。

```typescript
async onListChanged(serverName: string, handler: () => void): Promise<void>
```

例：

```typescript
mcpClient.resources.onListChanged('myWeatherServer', () => {
  console.log('myWeatherServer のリソース一覧が変更されました。');
  // リソース一覧を再取得してください
  // await mcpClient.resources.list();
});
```

### `prompts` プロパティ \{#prompts-property\}

`MCPClient` インスタンスには、プロンプト関連の操作にアクセスするための `prompts` プロパティが用意されています。

```typescript
const mcpClient = new MCPClient({
  /* ...サーバーの設定... */
});

// mcpClient.prompts 経由でプロンプト関連のメソッドにアクセス
const allPromptsByServer = await mcpClient.prompts.list();
const { prompt, messages } = await mcpClient.prompts.get({
  serverName: 'myWeatherServer',
  name: 'current',
});
```

### `elicitation` プロパティ \{#elicitation-property\}

`MCPClient` インスタンスには、elicitation 関連の操作にアクセスできる `elicitation` プロパティがあります。Elicitation により、MCP サーバーはユーザーに対して構造化された情報をリクエストできます。

```typescript
const mcpClient = new MCPClient({
  /* ...servers configuration... */
});

// エリシテーションハンドラーを設定
mcpClient.elicitation.onRequest('serverName', async request => {
  // サーバーからのエリシテーションリクエストを処理
  console.log('サーバーからのリクエスト:', request.message);
  console.log('スキーマ:', request.requestedSchema);

  // ユーザーの応答を返す
  return {
    action: 'accept',
    content: { name: 'John Doe', email: 'john@example.com' },
  };
});
```

#### `elicitation.onRequest(serverName: string, handler: ElicitationHandler)` \{#elicitationonrequestservername-string-handler-elicitationhandler\}

接続中のいずれかの MCP サーバーからエリシテーション要求が送られてきたときに呼び出されるハンドラー関数を設定します。ハンドラーはリクエストを受け取り、レスポンスを返す必要があります。

**ElicitationHandler 関数:**

ハンドラー関数は次のプロパティを持つリクエストオブジェクトを受け取ります:

* `message`: 必要な情報を説明する、人間が読めるメッセージ
* `requestedSchema`: 期待されるレスポンスの構造を定義する JSON スキーマ

ハンドラーは次の内容を持つ `ElicitResult` を返す必要があります:

* `action`: `'accept'`、`'decline'`、または `'cancel'` のいずれか
* `content`: ユーザーのデータ（`action` が `'accept'` の場合のみ）

**例:**

```typescript
mcpClient.elicitation.onRequest('serverName', async request => {
  console.log(`サーバーからの要求: ${request.message}`);

  // 例: 簡単なユーザー入力の収集
  if (request.requestedSchema.properties.name) {
    // ユーザーが承諾してデータを提供することをシミュレート
    return {
      action: 'accept',
      content: {
        name: 'Alice Smith',
        email: 'alice@example.com',
      },
    };
  }

  // ユーザーが要求を辞退することをシミュレート
  return { action: 'decline' };
});
```

**完全なインタラクティブな例:**

```typescript
import { MCPClient } from '@mastra/mcp';
import { createInterface } from 'readline';

const readline = createInterface({
  input: process.stdin,
  output: process.stdout,
});

function askQuestion(question: string): Promise<string> {
  return new Promise(resolve => {
    readline.question(question, answer => resolve(answer.trim()));
  });
}

const mcpClient = new MCPClient({
  servers: {
    interactiveServer: {
      url: new URL('http://localhost:3000/mcp'),
    },
  },
});

// Set up interactive elicitation handler
await mcpClient.elicitation.onRequest('interactiveServer', async request => {
  console.log(`\n📋 サーバーからのリクエスト: ${request.message}`);
  console.log('必要な情報:');

  const schema = request.requestedSchema;
  const properties = schema.properties || {};
  const required = schema.required || [];
  const content: Record<string, any> = {};

  // 各フィールドの入力を収集する
  for (const [fieldName, fieldSchema] of Object.entries(properties)) {
    const field = fieldSchema as any;
    const isRequired = required.includes(fieldName);

    let prompt = `${field.title || fieldName}`;
    if (field.description) prompt += ` (${field.description})`;
    if (isRequired) prompt += '（必須）';
    prompt += ': ';

    const answer = await askQuestion(prompt);

    // キャンセルの処理
    if (answer.toLowerCase() === 'cancel') {
      return { action: 'cancel' };
    }

    // 必須フィールドの検証
    if (answer === '' && isRequired) {
      console.log(`❌ ${fieldName} は必須です`);
      return { action: 'decline' };
    }

    if (answer !== '') {
      content[fieldName] = answer;
    }
  }

  // 送信内容の確認
  console.log('\n📝 入力内容:');
  console.log(JSON.stringify(content, null, 2));

  const confirm = await askQuestion('\nこの情報を送信しますか？（yes/no/cancel）：');

  if (confirm.toLowerCase() === 'yes' || confirm.toLowerCase() === 'y') {
    return { action: 'accept', content };
  } else if (confirm.toLowerCase() === 'cancel') {
    return { action: 'cancel' };
  } else {
    return { action: 'decline' };
  }
});
```

#### `prompts.list()` \{#promptslist\}

接続済みのすべての MCP サーバーから、利用可能なプロンプトをサーバー名ごとにグループ化して取得します。

```typescript
async list(): Promise<Record<string, Prompt[]>>
```

例：

```typescript
const promptsByServer = await mcpClient.prompts.list();
for (const serverName in promptsByServer) {
  console.log(`${serverName} からのプロンプト:`, promptsByServer[serverName]);
}
```

#### `prompts.get({ serverName, name, args?, version? })` \{#promptsget-servername-name-args-version\}

サーバーから特定のプロンプトとそのメッセージを取得します。

```typescript
async get({
  serverName,
  name,
  args?,
  version?,
}: {
  serverName: string;
  name: string;
  args?: Record<string, any>;
  version?: string;
}): Promise<{ prompt: Prompt; messages: PromptMessage[] }>
```

例：

```typescript
const { prompt, messages } = await mcpClient.prompts.get({
  serverName: 'myWeatherServer',
  name: 'current',
  args: { location: 'London' },
});
console.log(prompt);
console.log(messages);
```

#### `prompts.onListChanged(serverName: string, handler: () => void)` \{#promptsonlistchangedservername-string-handler-void\}

特定のサーバーで利用可能なプロンプト一覧が変更された際に呼び出される通知ハンドラーを設定します。

```typescript
async onListChanged(serverName: string, handler: () => void): Promise<void>
```

例：

```typescript
mcpClient.prompts.onListChanged('myWeatherServer', () => {
  console.log('myWeatherServer のプロンプトリストが変更されました。');
  // プロンプトリストを再取得してください
  // await mcpClient.prompts.list();
});
```

## エリシテーション（Elicitation） \{#elicitation\}

エリシテーション（Elicitation）は、MCP サーバーがユーザーに対して構造化された情報の提供を求められる機能です。サーバーが追加のデータを必要とする場合、クライアントがユーザーに入力を促す形で対話し、そのためのエリシテーション要求をサーバーが送信します。よくある例としては、ツールの呼び出し時があります。

### Elicitation の仕組み \{#how-elicitation-works\}

1. **サーバーリクエスト**: MCP サーバーのツールが、メッセージとスキーマを指定して `server.elicitation.sendRequest()` を呼び出す
2. **クライアントハンドラー**: あなたの elicitation ハンドラー関数がそのリクエストで呼び出される
3. **ユーザーとの対話**: ハンドラーがユーザー入力（UI や CLI など）を収集する
4. **レスポンス**: ハンドラーがユーザーの応答（accept/decline/cancel）を返す
5. **ツールの継続**: サーバー側のツールが応答を受け取り、実行を続行する

### エリシテーションのセットアップ \{#setting-up-elicitation\}

エリシテーションを使うツールを呼び出す前に、まずエリシテーションハンドラーを設定してください。

```typescript
import { MCPClient } from '@mastra/mcp';

const mcpClient = new MCPClient({
  servers: {
    interactiveServer: {
      url: new URL('http://localhost:3000/mcp'),
    },
  },
});

// 引き出し（elicitation）ハンドラーを設定する
mcpClient.elicitation.onRequest('interactiveServer', async request => {
  // サーバーからのユーザー入力のリクエストを処理する
  console.log(`サーバーの要求内容: ${request.message}`);

  // ユーザー入力を収集するためのロジック
  const userData = await collectUserInput(request.requestedSchema);

  return {
    action: 'accept',
    content: userData,
  };
});
```

### レスポンスタイプ \{#response-types\}

elicitation ハンドラーは、次のいずれかのレスポンスタイプを返す必要があります:

* **Accept**: ユーザーがデータを提供し、送信を確認した

  ```typescript
  return {
    action: 'accept',
    content: { name: 'John Doe', email: 'john@example.com' },
  };
  ```

* **Decline**: ユーザーが明示的に情報の提供を拒否した

  ```typescript
  return { action: 'decline' };
  ```

* **Cancel**: ユーザーがリクエストを却下またはキャンセルした
  ```typescript
  return { action: 'cancel' };
  ```

### スキーマベースの入力収集 \{#schema-based-input-collection\}

`requestedSchema` は、サーバーが必要とするデータの構造を定義します。

```typescript
await mcpClient.elicitation.onRequest('interactiveServer', async request => {
  const { properties, required = [] } = request.requestedSchema;
  const content: Record<string, any> = {};

  for (const [fieldName, fieldSchema] of Object.entries(properties || {})) {
    const field = fieldSchema as any;
    const isRequired = required.includes(fieldName);

    // フィールドの型と必須条件に基づいて入力を収集
    const value = await promptUser({
      name: fieldName,
      title: field.title,
      description: field.description,
      type: field.type,
      required: isRequired,
      format: field.format,
      enum: field.enum,
    });

    if (value !== null) {
      content[fieldName] = value;
    }
  }

  return { action: 'accept', content };
});
```

### ベストプラクティス \{#best-practices\}

* **常に尋ね返し（エリシテーション）に対応する**: エリシテーションを利用する可能性のあるツールを呼び出す前にハンドラーを設定する
* **入力を検証する**: 必須項目が入力されているか確認する
* **ユーザーの選択を尊重する**: 辞退やキャンセルの応答を丁寧に処理する
* **分かりやすいUI**: 何の情報を、なぜ求めているのかを明確に示す
* **セキュリティ**: 機微情報の要求を自動承認しない

## 例 \{#examples\}

### 静的ツール構成 \{#static-tool-configuration\}

アプリ全体で MCP サーバーへの接続が 1 つだけのツールの場合は、`getTools()` を使用してツールをエージェントに渡します。

```typescript
import { MCPClient } from '@mastra/mcp';
import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';

const mcp = new MCPClient({
  servers: {
    stockPrice: {
      command: 'npx',
      args: ['tsx', 'stock-price.ts'],
      env: {
        API_KEY: 'APIキー',
      },
      log: logMessage => {
        console.log(`[${logMessage.level}] ${logMessage.message}`);
      },
    },
    weather: {
      url: new URL('http://localhost:8080/sse'),
    },
  },
  timeout: 30000, // 全体のタイムアウトは30秒
});

// すべてのツールにアクセス可能なエージェントを作成
const agent = new Agent({
  name: 'マルチツール・エージェント',
  instructions: '複数のツールサーバーにアクセスできます。',
  model: openai('gpt-4'),
  tools: await mcp.getTools(),
});

// リソースメソッドの使用例
async function checkWeatherResource() {
  try {
    const weatherResources = await mcp.resources.list();
    if (weatherResources.weather && weatherResources.weather.length > 0) {
      const currentWeatherURI = weatherResources.weather[0].uri;
      const weatherData = await mcp.resources.read('weather', currentWeatherURI);
      console.log('天気データ: ', weatherData.contents[0].text);
    }
  } catch (error) {
    console.error('天気リソースの取得エラー: ', error);
  }
}
checkWeatherResource();

// プロンプトメソッドの使用例
async function checkWeatherPrompt() {
  try {
    const weatherPrompts = await mcp.prompts.list();
    if (weatherPrompts.weather && weatherPrompts.weather.length > 0) {
      const currentWeatherPrompt = weatherPrompts.weather.find(p => p.name === 'current');
      if (currentWeatherPrompt) {
        console.log('天気用プロンプト: ', currentWeatherPrompt);
      } else {
        console.log('現在の天気プロンプトが見つかりませんでした');
      }
    }
  } catch (error) {
    console.error('天気プロンプトの取得エラー: ', error);
  }
}
checkWeatherPrompt();
```

### 動的ツールセット \{#dynamic-toolsets\}

ユーザーごとに新しい MCP 接続が必要な場合は、`getToolsets()` を使用し、stream や generate を呼び出す際にツールを追加します。

```typescript
import { Agent } from '@mastra/core/agent';
import { MCPClient } from '@mastra/mcp';
import { openai } from '@ai-sdk/openai';

// まずはツールなしでエージェントを作成します
const agent = new Agent({
  name: 'マルチツール・エージェント',
  instructions: 'ユーザーの株価と天気の確認をサポートします。',
  model: openai('gpt-4'),
});

// 後で、ユーザーごとの設定で MCP を構成します
const mcp = new MCPClient({
  servers: {
    stockPrice: {
      command: 'npx',
      args: ['tsx', 'stock-price.ts'],
      env: {
        API_KEY: 'user-123-api-key',
      },
      timeout: 20000, // サーバー個別のタイムアウト
    },
    weather: {
      url: new URL('http://localhost:8080/sse'),
      requestInit: {
        headers: {
          Authorization: `Bearer user-123-token`,
        },
      },
    },
  },
});

// すべてのツールセットを stream() または generate() に渡します
const response = await agent.stream('AAPL の状況はどう？ 天気はどう？', {
  toolsets: await mcp.getToolsets(),
});
```

## インスタンス管理 \{#instance-management\}

`MCPClient` クラスには、複数インスタンスの管理におけるメモリリーク防止機能が組み込まれています。

1. `id` を指定せずに同一の構成で複数のインスタンスを作成しようとすると、メモリリーク防止のためにエラーが発生します
2. 同一の構成で複数のインスタンスが必要な場合は、各インスタンスに一意の `id` を指定してください
3. 同じ構成のインスタンスを再作成する前に、`await configuration.disconnect()` を呼び出してください
4. インスタンスが 1 つだけで十分な場合は、再作成を避けるために構成をより高いスコープへ移動することを検討してください

たとえば、`id` なしで同じ構成の複数インスタンスを作成しようとすると：

```typescript
// 最初のインスタンス - OK
const mcp1 = new MCPClient({
  servers: {
    /* ... */
  },
});

// 同じ設定で2つ目のインスタンス - エラーが発生します
const mcp2 = new MCPClient({
  servers: {
    /* ... */
  },
});

// 解決方法はいずれか:
// 1. 一意のIDを追加する
const mcp3 = new MCPClient({
  id: 'instance-1',
  servers: {
    /* ... */
  },
});

// 2. または再作成前に切断する
await mcp1.disconnect();
const mcp4 = new MCPClient({
  servers: {
    /* ... */
  },
});
```

## サーバーのライフサイクル \{#server-lifecycle\}

MCPClient はサーバー接続を適切に処理します:

1. 複数サーバーに対する自動接続管理
2. 開発中のエラーメッセージを防ぐための、正常なサーバーのシャットダウン
3. 切断時のリソースの適切なクリーンアップ

## SSE リクエストヘッダーの使用 \{#using-sse-request-headers\}

レガシーな SSE MCP トランスポートを使用する場合、MCP SDK の不具合により、`requestInit` と `eventSourceInit` の両方を設定する必要があります。

```ts
const sseClient = new MCPClient({
  servers: {
    exampleServer: {
      url: new URL('https://your-mcp-server.com/sse'),
      // 注意: requestInit だけでは SSE には不十分です
      requestInit: {
        headers: {
          Authorization: 'Bearer your-token',
        },
      },
      // カスタムヘッダー付きの SSE 接続でもこれが必要です
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
    },
  },
});
```

## 関連情報 \{#related-information\}

* MCP サーバーの作成については、[MCPServer ドキュメント](./mcp-server)を参照してください。
* Model Context Protocol について詳しくは、[@modelcontextprotocol/sdk ドキュメント](https://github.com/modelcontextprotocol/typescript-sdk)をご覧ください。
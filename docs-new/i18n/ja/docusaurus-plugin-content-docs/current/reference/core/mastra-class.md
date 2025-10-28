---
title: "リファレンス: Mastra クラス"
description: "Mastra の `Mastra` クラスに関するドキュメント。エージェント、ワークフロー、MCP サーバー、サーバーエンドポイントを管理するための中核的なエントリポイントです。"
---

# Mastra クラス \{#mastra-class\}

`Mastra` クラスは、あらゆる Mastra アプリケーションにおける中核的なオーケストレーターで、エージェント、ワークフロー、ストレージ、ログ、テレメトリーなどを管理します。通常、アプリケーション全体を統括するために `Mastra` のインスタンスを1つだけ作成します。

`Mastra` はトップレベルのレジストリと考えてください。

* **integrations** を登録すると、**agents**、**workflows**、**tools** から利用できます。
* **tools** は `Mastra` に直接登録するのではなく、エージェントに関連付けられ、自動的に検出されます。

## 使い方の例 \{#usage-example\}

```typescript filename="src/mastra/index.ts"
import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { weatherWorkflow } from './workflows/weather-workflow';
import { weatherAgent } from './agents/weather-agent';

export const mastra = new Mastra({
  workflows: { weatherWorkflow },
  agents: { weatherAgent },
  storage: new LibSQLStore({
    url: ':memory:',
  }),
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
```

## コンストラクターのパラメータ \{#constructor-parameters\}

<PropertiesTable
  content={[
{
name: "agents",
type: "Agent[]",
description: "登録する Agent インスタンスの配列",
isOptional: true,
defaultValue: "[]",
},
{
name: "tools",
type: "Record<string, ToolApi>",
description:
"登録するカスタムツール。キーをツール名、値をツール関数とするキーと値のペア形式です。",
isOptional: true,
defaultValue: "{}",
},
{
name: "storage",
type: "MastraStorage",
description: "データ永続化のためのストレージエンジンインスタンス",
isOptional: true,
},
{
name: "vectors",
type: "Record<string, MastraVector>",
description:
"セマンティック検索やベクター系ツール（例: Pinecone、PgVector、Qdrant）に使用するベクターストアのインスタンス",
isOptional: true,
},
{
name: "logger",
type: "Logger",
description: "new PinoLogger() で作成された Logger インスタンス",
isOptional: true,
defaultValue: "INFO レベルのコンソールロガー",
},
{
name: "idGenerator",
type: "() => string",
description: "カスタム ID 生成関数。エージェント、ワークフロー、メモリ、その他のコンポーネントで一意の識別子を生成するために使用されます。",
isOptional: true,
},
{
name: "workflows",
type: "Record<string, Workflow>",
description:
"登録するワークフロー。キーをワークフロー名、値をワークフローインスタンスとするキーと値のペア形式です。",
isOptional: true,
defaultValue: "{}",
},
{
name: "tts",
type: "Record<string, MastraTTS>",
isOptional: true,
description: "Text-To-Speech サービスを登録するためのオブジェクト。",
},
{
name: "telemetry",
type: "OtelConfig",
isOptional: true,
description: "OpenTelemetry 連携用の設定。",
},
{
name: "deployer",
type: "MastraDeployer",
isOptional: true,
description: "デプロイ管理用の MastraDeployer インスタンス。",
},
{
name: "server",
type: "ServerConfig",
description:
"ポート、ホスト、タイムアウト、API ルート、ミドルウェア、CORS 設定、Swagger UI のビルドオプション、API リクエストのログ出力、OpenAPI ドキュメントなどを含むサーバー設定。",
isOptional: true,
defaultValue:
"{ port: 4111, host: localhost, cors: { origin: '\*', allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], allowHeaders: ['Content-Type', 'Authorization', 'x-mastra-client-type'], exposeHeaders: ['Content-Length', 'X-Requested-With'], credentials: false } }",
},
{
name: "mcpServers",
type: "Record<string, MCPServerBase>",
isOptional: true,
description:
"キーが一意のサーバー識別子、値が MCPServer のインスタンスまたは MCPServerBase を継承するクラスのインスタンスであるオブジェクト。これにより、Mastra はこれらの MCP サーバーを把握し、必要に応じて管理できます。",
},
{
name: "bundler",
type: "BundlerConfig",
description: "externals、sourcemap、transpilePackages のオプションを持つアセットバンドラの設定。",
isOptional: true,
defaultValue: "{ externals: [], sourcemap: false, transpilePackages: [] }",
},
{
name: "scorers",
type: "Record<string, MastraScorer>",
description: "トレースのスコアリング用に登録するスコアラー。エージェント生成やワークフロー実行時に使用されるデフォルトのスコアラーを上書きできます。キーをスコアラー名、値をスコアラーインスタンスとするキーと値のペア形式です。",
isOptional: true,
defaultValue: "{}",
},
]}
/>
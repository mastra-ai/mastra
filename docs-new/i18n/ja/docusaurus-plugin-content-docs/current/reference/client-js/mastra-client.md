---
title: MastraClient
description: client-js SDK を使って Mastra と連携する方法を学びます。
---

# Mastra Client SDK \{#mastra-client-sdk\}

Mastra Client SDKは、クライアント環境から[Mastra Server](/docs/deployment/server-deployment)と対話するための、シンプルで型安全なインターフェースを提供します。

## 使い方の例 \{#usage-example\}

```typescript filename="lib/mastra/mastra-client.ts" showLineNumbers copy
import { MastraClient } from '@mastra/client-js';

export const mastraClient = new MastraClient({
  baseUrl: 'http://localhost:4111/',
});
```

## パラメータ \{#parameters\}

<PropertiesTable
  content={[
{
name: "baseUrl",
type: "string",
description: "Mastra API のベース URL。すべてのリクエストはこの URL を基準に送信されます。",
isOptional: false,
},
{
name: "retries",
type: "number",
description: "エラーをスローする前に、失敗したリクエストを再試行する回数。",
isOptional: true,
defaultValue: "3",
},
{
name: "backoffMs",
type: "number",
description: "失敗したリクエストを再試行するまでの初回遅延時間（ミリ秒）。この値は再試行のたびに倍増します（指数バックオフ）。",
isOptional: true,
defaultValue: "300",
},
{
name: "maxBackoffMs",
type: "number",
description: "最大バックオフ時間（ミリ秒）。再試行間の待機が長くなりすぎることを防ぎます。",
isOptional: true,
defaultValue: "5000",
},
{
name: "headers",
type: "Record<string, string>",
description: "すべてのリクエストに付与するカスタム HTTP ヘッダーのオブジェクト。",
isOptional: true,
},
{
name: "credentials",
type: '"omit" | "same-origin" | "include"',
description: "リクエストの認証情報モード。詳細は https://developer.mozilla.org/en-US/docs/Web/API/Request/credentials を参照してください。",
isOptional: true,
},
]}
/>

## メソッド \{#methods\}

<PropertiesTable
  content={[
{
name: "getAgents()",
type: "Promise<Record<string, GetAgentResponse>>",
description: "利用可能なすべてのエージェントインスタンスを返します。",
},
{
name: "getAgent(agentId)",
type: "Agent",
description: "IDで特定のエージェントインスタンスを取得します。",
},
{
name: "getMemoryThreads(params)",
type: "Promise<StorageThreadType[]>",
description: "指定したリソースとエージェントのメモリスレッドを取得します。`resourceId` と `agentId` が必要です。",
},
{
name: "createMemoryThread(params)",
type: "Promise<MemoryThread>",
description: "指定したパラメータで新しいメモリスレッドを作成します。",
},
{
name: "getMemoryThread(threadId)",
type: "Promise<MemoryThread>",
description: "IDで特定のメモリスレッドを取得します。",
},
{
name: "saveMessageToMemory(params)",
type: "Promise<void>",
description: "1件以上のメッセージをメモリシステムに保存します。",
},
{
name: "getMemoryStatus()",
type: "Promise<MemoryStatus>",
description: "メモリシステムの現在の状態を返します。",
},
{
name: "getTools()",
type: "Record<string, Tool>",
description: "利用可能なすべてのツールを返します。",
},
{
name: "getTool(toolId)",
type: "Tool",
description: "IDで特定のツールインスタンスを取得します。",
},
{
name: "getWorkflows()",
type: "Record<string, Workflow>",
description: "利用可能なすべてのワークフローインスタンスを返します。",
},
{
name: "getWorkflow(workflowId)",
type: "Workflow",
description: "IDで特定のワークフローインスタンスを取得します。",
},
{
name: "getVector(vectorName)",
type: "MastraVector",
description: "名前を指定してベクターストアのインスタンスを返します。",
},
{
name: "getLogs(params)",
type: "Promise<LogEntry[]>",
description: "指定したフィルターに一致するシステムログを取得します。",
},
{
name: "getLog(params)",
type: "Promise<LogEntry>",
description: "IDまたはフィルターで特定のログエントリを取得します。",
},
{
name: "getLogTransports()",
type: "string[]",
description: "設定済みのログトランスポート方式の一覧を返します。",
},
{
name: "getAITrace(traceId)",
type: "Promise<AITraceRecord>",
description: "IDで特定のAIトレースを取得します（すべてのスパンと詳細を含みます）。",
},
{
name: "getAITraces(params)",
type: "Promise<GetAITracesResponse>",
description: "AIトレースのルートスパンのページネーションされた一覧を、任意のフィルター付きで取得します。すべてのスパンを含む完全なトレースを取得するには getAITrace() を使用してください。",
},
]}
/>
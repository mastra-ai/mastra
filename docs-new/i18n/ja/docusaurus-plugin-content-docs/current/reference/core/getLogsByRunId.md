---
title: "Mastra.getLogsByRunId() "
description: "Mastra の `Mastra.getLogsByRunId()` メソッドのドキュメント。特定の実行 ID とトランスポート ID に対応するログを取得します。"
---

# Mastra.getLogsByRunId() \{#mastragetlogsbyrunid\}

`.getLogsByRunId()` メソッドは、特定の実行IDとトランスポートIDに対するログを取得するために使用します。このメソッドを使用するには、`getLogsByRunId` 操作をサポートするように構成されたロガーが必要です。

## 使い方の例 \{#usage-example\}

```typescript copy
mastra.getLogsByRunId({ runId: '123', transportId: '456' });
```

## パラメータ \{#parameters\}

<PropertiesTable
  content={[
{
name: "runId",
type: "string",
description: "ログを取得する対象の実行ID。",
},
{
name: "transportId",
type: "string",
description: "ログを取得する対象のトランスポートID。",
},
{
name: "fromDate",
type: "Date",
description: "ログのフィルタリングに使用する任意の開始日。例: new Date('2024-01-01')。",
optional: true,
},
{
name: "toDate",
type: "Date",
description: "ログのフィルタリングに使用する任意の終了日。例: new Date('2024-01-31')。",
optional: true,
},
{
name: "logLevel",
type: "LogLevel",
description: "フィルタリングに使用する任意のログレベル。",
optional: true,
},
{
name: "filters",
type: "Record<string, any>",
description: "ログクエリに適用する任意の追加フィルタ。",
optional: true,
},
{
name: "page",
type: "number",
description: "ページネーション用の任意のページ番号。",
optional: true,
},
{
name: "perPage",
type: "number",
description: "ページネーションにおける1ページあたりのログ件数（任意）。",
optional: true,
},
]}
/>

## 戻り値 \{#returns\}

<PropertiesTable
  content={[
{
name: "logs",
type: "Promise<any>",
description: "指定された実行IDとトランスポートIDのログに解決される Promise。",
},
]}
/>

## 関連 \{#related\}

* [ロギング概要](/docs/observability/logging)
* [ロガーリファレンス](/docs/reference/observability/logging/pino-logger)
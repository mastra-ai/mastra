---
title: "Mastra.getLogs() "
description: "Mastra の `Mastra.getLogs()` メソッドに関するドキュメント。特定の transport ID に紐づくすべてのログを取得します。"
---

# Mastra.getLogs() \{#mastragetlogs\}

`.getLogs()` メソッドは、特定の transport ID に対するすべてのログを取得するために使用します。このメソッドを利用するには、`getLogs` 操作をサポートするように構成されたロガーが必要です。

## 使用例 \{#usage-example\}

```typescript copy
mastra.getLogs('456');
```

## パラメータ \{#parameters\}

<PropertiesTable
  content={[
{
name: "transportId",
type: "string",
description: "ログを取得する対象のtransport ID。",
},
{
name: "options",
type: "object",
description: "フィルタリングおよびページネーション用の任意のパラメータ。詳細は以下のOptionsセクションを参照してください。",
optional: true,
},
]}
/>

### オプション \{#options\}

<PropertiesTable
  content={[
{
name: "fromDate",
type: "Date",
description: "ログを絞り込むための開始日（任意）。例: new Date('2024-01-01')。",
optional: true,
},
{
name: "toDate",
type: "Date",
description: "ログを絞り込むための終了日（任意）。例: new Date('2024-01-31')。",
optional: true,
},
{
name: "logLevel",
type: "LogLevel",
description: "絞り込みに使用するログレベル（任意）。",
optional: true,
},
{
name: "filters",
type: "Record<string, any>",
description: "ログクエリに適用する追加のフィルター（任意）。",
optional: true,
},
{
name: "page",
type: "number",
description: "ページネーション用のページ番号（任意）。",
optional: true,
},
{
name: "perPage",
type: "number",
description: "ページネーションでの1ページあたりのログ件数（任意）。",
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
description: "指定した transport ID のログを返す Promise。",
},
]}
/>

## 関連情報 \{#related\}

* [ロギングの概要](/docs/observability/logging)
* [ロガー リファレンス](/docs/reference/observability/logging/pino-logger)
---
title: Mastra クライアントツール API
description: client-js SDK を使って、Mastra プラットフォーム上のツールとやり取りし、実行する方法を学びます。
---

# Tools API \{#tools-api\}

Tools API は、Mastra プラットフォームで利用可能なツールとの対話や実行を行うためのメソッドを提供します。

## すべてのツールを取得 \{#getting-all-tools\}

利用可能なツールの一覧を取得します:

```typescript
const tools = await mastraClient.getTools();
```

## 特定のツールを使う \{#working-with-a-specific-tool\}

特定のツールのインスタンスを取得する:

```typescript
const tool = mastraClient.getTool('tool-id');
```

## ツールのメソッド \{#tool-methods\}

### ツールの詳細を取得 \{#get-tool-details\}

ツールの詳細情報を取得します。

```typescript
const details = await tool.details();
```

### ツールを実行する \{#execute-tool\}

指定した引数でツールを実行します:

```typescript
const result = await tool.execute({
  args: {
    param1: 'value1',
    param2: 'value2',
  },
  threadId: 'thread-1', // オプション: スレッドのコンテキスト
  resourceId: 'resource-1', // オプション: リソースの識別子
});
```

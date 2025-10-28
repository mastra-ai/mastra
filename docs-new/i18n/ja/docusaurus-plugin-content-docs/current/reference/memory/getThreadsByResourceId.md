---
title: "Memory.getThreadsByResourceId() "
description: "Mastra の `Memory.getThreadsByResourceId()` メソッドに関するドキュメント。特定のリソースに紐づくすべてのスレッドを取得します。"
---

# Memory.getThreadsByResourceId() \{#memorygetthreadsbyresourceid\}

`.getThreadsByResourceId()` 関数は、ストレージから特定のリソース ID に関連付けられたすべてのスレッドを取得します。スレッドは作成時刻または更新時刻で、昇順または降順に並べ替えることができます。

## 使い方の例 \{#usage-example\}

```typescript
await memory?.getThreadsByResourceId({ resourceId: 'user-123' });
```

## パラメータ \{#parameters\}

<PropertiesTable
  content={[
{
name: "resourceId",
type: "string",
description: "スレッドを取得する対象リソースのID。",
isOptional: false,
},
{
name: "orderBy",
type: "ThreadOrderBy",
description: "スレッドの並び替え対象フィールド。'createdAt' または 'updatedAt' を指定できます。デフォルト: 'createdAt'",
isOptional: true,
},
{
name: "sortDirection",
type: "ThreadSortDirection",
description: "並び順。'ASC' または 'DESC' を指定できます。デフォルト: 'DESC'",
isOptional: true,
},
]}
/>

## 戻り値 \{#returns\}

<PropertiesTable
  content={[
{
name: "StorageThreadType[]",
type: "Promise",
description:
"指定されたリソースIDに関連付けられたスレッドの配列を解決結果として返す Promise。",
},
]}
/>

## 拡張的な使用例 \{#extended-usage-example\}

```typescript filename="src/test-memory.ts" showLineNumbers copy
import { mastra } from './mastra';

const agent = mastra.getAgent('agent');
const memory = await agent.getMemory();

const thread = await memory?.getThreadsByResourceId({
  resourceId: 'user-123',
  orderBy: 'updatedAt',
  sortDirection: 'ASC',
});

console.log(thread);
```

### 関連 \{#related\}

* [Memory クラス リファレンス](/docs/reference/memory)
* [getThreadsByResourceIdPaginated](/docs/reference/memory/getThreadsByResourceIdPaginated) - ページネーション対応版
* [Memory のはじめ方](/docs/memory/overview)（threads/resources の概念を解説）
* [createThread](/docs/reference/memory/createThread)
* [getThreadById](/docs/reference/memory/getThreadById)
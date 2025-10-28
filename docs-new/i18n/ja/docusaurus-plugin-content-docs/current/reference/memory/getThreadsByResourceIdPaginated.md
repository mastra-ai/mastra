---
title: "Memory.getThreadsByResourceIdPaginated() "
description: "Mastra の `Memory.getThreadsByResourceIdPaginated()` メソッドに関するドキュメント。特定のリソース ID に紐づくスレッドを、ページネーション対応で取得します。"
---

# Memory.getThreadsByResourceIdPaginated() \{#memorygetthreadsbyresourceidpaginated\}

`.getThreadsByResourceIdPaginated()` メソッドは、特定のリソース ID に紐づくスレッドをページネーション対応で取得します。

## 使い方の例 \{#usage-example\}

```typescript copy
await memory.getThreadsByResourceIdPaginated({
  resourceId: 'user-123',
  page: 0,
  perPage: 10,
});
```

## パラメータ \{#parameters\}

<PropertiesTable
  content={[
{
name: "resourceId",
type: "string",
description: "スレッドを取得する対象リソースのID",
isOptional: false,
},
{
name: "page",
type: "number",
description: "取得するページ番号",
isOptional: false,
},
{
name: "perPage",
type: "number",
description: "1ページあたりの返却スレッド数",
isOptional: false,
},
{
name: "orderBy",
type: "'createdAt' | 'updatedAt'",
description: "スレッドの並び替え対象フィールド",
isOptional: true,
},
{
name: "sortDirection",
type: "'ASC' | 'DESC'",
description: "並び順の方向",
isOptional: true,
},
]}
/>

## 戻り値 \{#returns\}

<PropertiesTable
  content={[
{
name: "result",
type: "Promise<PaginationInfo & { threads: StorageThreadType[] }>",
description: "メタデータ付きのページネーション済みスレッド結果を返す Promise",
},
]}
/>

## 応用例 \{#extended-usage-example\}

```typescript filename="src/test-memory.ts" showLineNumbers copy
import { mastra } from './mastra';

const agent = mastra.getAgent('agent');
const memory = await agent.getMemory();

let currentPage = 0;
let hasMorePages = true;

while (hasMorePages) {
  const threads = await memory?.getThreadsByResourceIdPaginated({
    resourceId: 'user-123',
    page: currentPage,
    perPage: 25,
    orderBy: 'createdAt',
    sortDirection: 'ASC',
  });

  if (!threads) {
    console.log('スレッドがありません');
    break;
  }

  threads.threads.forEach(thread => {
    console.log(`スレッド: ${thread.id}, 作成日時: ${thread.createdAt}`);
  });

  hasMorePages = threads.hasMore;
  currentPage++;
}
```

## 関連 \{#related\}

* [Memory クラス リファレンス](/docs/reference/memory)
* [getThreadsByResourceId](/docs/reference/memory/getThreadsByResourceId) - ページネーションなしのバージョン
* [Memory のはじめ方](/docs/memory/overview)（スレッド／リソースの概念を解説）
* [createThread](/docs/reference/memory/createThread)
* [getThreadById](/docs/reference/memory/getThreadById)
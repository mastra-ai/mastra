---
title: "Memory.createThread() "
description: "Mastra の `Memory.createThread()` メソッドに関するドキュメント。メモリシステム内に新しい会話スレッドを作成します。"
---

# Memory.createThread() \{#memorycreatethread\}

`.createThread()` メソッドは、メモリシステム内に新しい会話スレッドを作成します。各スレッドは、独立した会話やコンテキストを表し、複数のメッセージを含めることができます。

## 使い方の例 \{#usage-example\}

```typescript copy
await memory?.createThread({ resourceId: 'user-123' });
```

## パラメータ \{#parameters\}

<PropertiesTable
  content={[
{
name: "resourceId",
type: "string",
description:
"このスレッドが属するリソースの識別子（例：ユーザーID、プロジェクトID）",
isOptional: false,
},
{
name: "threadId",
type: "string",
description:
"スレッドのカスタムID（任意）。未指定の場合は自動生成されます。",
isOptional: true,
},
{
name: "title",
type: "string",
description: "スレッドのタイトル（任意）",
isOptional: true,
},
{
name: "metadata",
type: "Record<string, unknown>",
description: "スレッドに関連付けるメタデータ（任意）",
isOptional: true,
},
]}
/>

## 戻り値 \{#returns\}

<PropertiesTable
  content={[
{
name: "id",
type: "string",
description: "作成されたスレッドの一意の識別子",
},
{
name: "resourceId",
type: "string",
description: "スレッドに関連付けられたリソース ID",
},
{
name: "title",
type: "string",
description: "スレッドのタイトル（指定されている場合）",
},
{
name: "createdAt",
type: "Date",
description: "スレッドが作成された時点のタイムスタンプ",
},
{
name: "updatedAt",
type: "Date",
description: "スレッドが最後に更新された時点のタイムスタンプ",
},
{
name: "metadata",
type: "Record<string, unknown>",
description: "スレッドに関連付けられた追加メタデータ",
},
]}
/>

## 応用例 \{#extended-usage-example\}

```typescript filename="src/test-memory.ts" showLineNumbers copy
import { mastra } from './mastra';

const agent = mastra.getAgent('agent');
const memory = await agent.getMemory();

const thread = await memory?.createThread({
  resourceId: 'user-123',
  title: 'メモリーテストスレッド',
  metadata: {
    source: 'test-script',
    purpose: 'memory-testing',
  },
});

const response = await agent.generate('エージェントへのメッセージ', {
  memory: {
    thread: thread!.id,
    resource: thread!.resourceId,
  },
});

console.log(response.text);
```

### 関連 \{#related\}

* [Memory クラス リファレンス](/docs/reference/memory)
* [Memory のはじめかた](/docs/memory/overview)（スレッドの概念を解説）
* [getThreadById](/docs/reference/memory/getThreadById)
* [getThreadsByResourceId](/docs/reference/memory/getThreadsByResourceId)
* [query](/docs/reference/memory/query)
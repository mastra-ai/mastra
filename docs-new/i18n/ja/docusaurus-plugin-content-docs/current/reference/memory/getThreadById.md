---
title: "Memory.getThreadById()"
description: "Mastra の `Memory.getThreadById()` メソッドのドキュメント。ID によって特定のスレッドを取得します。"
---

# Memory.getThreadById() \{#memorygetthreadbyid\}

`.getThreadById()` メソッドは、ID を指定して特定のスレッドを取得します。

## 使用例 \{#usage-example\}

```typescript
await memory?.getThreadById({ threadId: 'thread-123' });
```

## パラメータ \{#parameters\}

<PropertiesTable
  content={[
{
name: "threadId",
type: "string",
description: "取得対象のスレッド ID。",
isOptional: false,
},
]}
/>

## 戻り値 \{#returns\}

<PropertiesTable
  content={[
{
name: "thread",
type: "Promise<StorageThreadType | null>",
description: "指定されたIDに対応するスレッドを返すPromise。見つからない場合は null。",
},
]}
/>

### 関連 \{#related\}

* [Memory クラスリファレンス](/docs/reference/memory)
* [Memory のはじめ方](/docs/memory/overview)（スレッドの概念を扱います）
* [createThread](/docs/reference/memory/createThread)
* [getThreadsByResourceId](/docs/reference/memory/getThreadsByResourceId)
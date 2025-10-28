---
title: "Memory.deleteMessages() "
description: "Mastra の `Memory.deleteMessages()` メソッドのドキュメント。複数のメッセージを ID を指定して削除します。"
---

# Memory.deleteMessages() \{#memorydeletemessages\}

`.deleteMessages()` メソッドは、IDを指定して複数のメッセージを削除します。

## 使い方の例 \{#usage-example\}

```typescript copy
await memory?.deleteMessages(['671ae63f-3a91-4082-a907-fe7de78e10ec']);
```

## パラメータ \{#parameters\}

<PropertiesTable
  content={[
{
name: "messageIds",
type: "string[]",
description: "削除対象のメッセージIDの配列",
isOptional: false,
},
]}
/>

## 返り値 \{#returns\}

<PropertiesTable
  content={[
{
name: "void",
type: "Promise<void>",
description: "すべてのメッセージの削除完了時に解決される Promise",
},
]}
/>

## 拡張的な使用例 \{#extended-usage-example\}

```typescript filename="src/test-memory.ts" showLineNumbers copy
import { mastra } from './mastra';
import { UIMessageWithMetadata } from '@mastra/core/agent';

const agent = mastra.getAgent('agent');
const memory = await agent.getMemory();

const { uiMessages } = await memory!.query({ threadId: 'thread-123' });

const messageIds = uiMessages.map((message: UIMessageWithMetadata) => message.id);
await memory?.deleteMessages([...messageIds]);
```

## 関連情報 \{#related\}

* [Memory クラス リファレンス](/docs/reference/memory)
* [query](/docs/reference/memory/query)
* [Memory の始め方](/docs/memory/overview)
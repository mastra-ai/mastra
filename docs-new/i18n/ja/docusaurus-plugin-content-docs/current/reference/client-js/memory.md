---
title: Mastra クライアント用メモリ API
description: client-js SDK を使って、Mastra の会話スレッドとメッセージ履歴を管理する方法を学びましょう。
---

# メモリ API \{#memory-api\}

メモリ API は、Mastra の会話スレッドやメッセージ履歴を管理するためのメソッドを提供します。

### すべてのスレッドを取得 \{#get-all-threads\}

特定のリソースに紐づくメモリースレッドをすべて取得します:

```typescript
const threads = await mastraClient.getMemoryThreads({
  resourceId: 'resource-1',
  agentId: 'agent-1',
});
```

### 新規スレッドの作成 \{#create-a-new-thread\}

新しいメモリスレッドを作成します：

```typescript
const thread = await mastraClient.createMemoryThread({
  title: '新しい会話',
  metadata: { category: 'support' },
  resourceId: 'resource-1',
  agentId: 'agent-1',
});
```

### 特定のスレッドを扱う \{#working-with-a-specific-thread\}

特定のメモリースレッドのインスタンスを取得します：

```typescript
const thread = mastraClient.getMemoryThread('thread-id', 'agent-id');
```

## スレッドのメソッド \{#thread-methods\}

### スレッドの詳細を取得 \{#get-thread-details\}

特定のスレッドの詳細を取得します。

```typescript
const details = await thread.get();
```

### スレッドの更新 \{#update-thread\}

スレッドのプロパティを更新します：

```typescript
const updated = await thread.update({
  title: '更新後のタイトル',
  metadata: { status: '解決済み' },
  resourceId: 'resource-1',
});
```

### スレッドを削除 \{#delete-thread\}

スレッドとそのメッセージを削除します。

```typescript
await thread.delete();
```

## メッセージの操作 \{#message-operations\}

### メッセージの保存 \{#save-messages\}

メッセージをメモリに保存する：

```typescript
const savedMessages = await mastraClient.saveMessageToMemory({
  messages: [
    {
      role: 'user',
      content: 'こんにちは！',
      id: '1',
      threadId: 'thread-1',
      createdAt: new Date(),
      type: 'text',
    },
  ],
  agentId: 'agent-1',
});
```

### スレッドメッセージの取得 \{#retrieve-thread-messages\}

メモリスレッドに関連するメッセージを取得します：

```typescript
// スレッド内のすべてのメッセージを取得する
const { messages } = await thread.getMessages();

// 取得するメッセージ数を制限する
const { messages } = await thread.getMessages({ limit: 10 });
```

### メッセージの削除 \{#delete-a-message\}

スレッドから特定のメッセージを削除します:

```typescript
const result = await thread.deleteMessage('message-id');
// 戻り値: { success: true, message: "メッセージは正常に削除されました" }
```

### 複数のメッセージを削除する \{#delete-multiple-messages\}

1回の操作でスレッドから複数のメッセージを削除します：

```typescript
const result = await thread.deleteMessages(['message-1', 'message-2', 'message-3']);
// 戻り値: { success: true, message: "3件のメッセージが正常に削除されました" }
```

### メモリの状態を取得 \{#get-memory-status\}

メモリシステムの状態を確認します：

```typescript
const status = await mastraClient.getMemoryStatus('agent-id');
```

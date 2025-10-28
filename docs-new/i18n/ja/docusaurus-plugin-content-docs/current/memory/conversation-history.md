---
title: "会話履歴"
description: "Mastra で会話履歴を設定し、現在の会話の最近のメッセージを保存する方法を学びます。"
sidebar_position: 4
---

# 会話履歴 \{#conversation-history\}

会話履歴は最も基本的な種類のメモリです。現在の会話に含まれるメッセージの一覧です。

デフォルトでは、各リクエストに現在のメモリスレッドから直近10件のメッセージが含まれ、エージェントに短期的な会話コンテキストを提供します。この上限は `lastMessages` パラメータで増やせます。

この上限は、`Memory` インスタンスに `lastMessages` パラメータを渡すことで引き上げられます。

```typescript {3-7} showLineNumbers
export const testAgent = new Agent({
  // ...
  memory: new Memory({
    options: {
      lastMessages: 100,
    },
  }),
});
```

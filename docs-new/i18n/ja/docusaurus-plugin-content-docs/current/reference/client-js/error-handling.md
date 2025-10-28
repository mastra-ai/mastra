---
title: Mastra クライアントのエラー処理
description: Mastra client-js SDK に搭載されたリトライ機能とエラー処理について学びます。
---

# エラーハンドリング \{#error-handling\}

Mastra Client SDK には、リトライ機構とエラーハンドリング機能が標準で備わっています。

## エラー処理 \{#error-handling\}

すべての API メソッドは、キャッチして適切に処理できるエラーをスローする可能性があります。

```typescript
try {
  const agent = mastraClient.getAgent('agent-id');
  const response = await agent.generate({
    messages: [{ role: 'user', content: 'こんにちは' }],
  });
} catch (error) {
  console.error('エラーが発生しました:', error.message);
}
```

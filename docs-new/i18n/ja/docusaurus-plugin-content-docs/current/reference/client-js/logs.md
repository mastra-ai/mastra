---
title: Mastra クライアントログ API
description: client-js SDK を使って、Mastra のシステムログやデバッグ情報にアクセスし、クエリを実行する方法を学びます。
---

# Logs API \{#logs-api\}

Logs API は、Mastra のシステムログやデバッグ情報へのアクセスとクエリ実行のためのメソッドを提供します。

## ログの取得 \{#getting-logs\}

必要に応じてフィルターを適用してシステムログを取得します：

```typescript
const logs = await mastraClient.getLogs({
  transportId: 'transport-1',
});
```

## 特定の実行のログを取得する \{#getting-logs-for-a-specific-run\}

特定の実行のログを取得します:

```typescript
const runLogs = await mastraClient.getLogForRun({
  runId: 'run-1',
  transportId: 'transport-1',
});
```

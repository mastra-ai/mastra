---
title: Mastra クライアント テレメトリー API
description: client-js SDK を使って、Mastra アプリケーションのトレースを取得・分析し、監視やデバッグに活用する方法を学びます。
---

# Telemetry API \{#telemetry-api\}

Telemetry API は、Mastra アプリケーションのトレースを取得して分析するためのメソッドを提供します。これにより、アプリケーションの挙動やパフォーマンスを監視し、デバッグできます。

## トレースの取得 \{#getting-traces\}

必要に応じてフィルタリングやページングを指定して、トレースを取得します。

```typescript
const telemetry = await mastraClient.getTelemetry({
  name: 'trace-name', // 任意: トレース名でフィルタ
  scope: 'scope-name', // 任意: スコープでフィルタ
  page: 1, // 任意: ページ番号（ページネーション用）
  perPage: 10, // 任意: 1ページあたりの件数
  attribute: {
    // 任意: カスタム属性でフィルタ
    key: 'value',
  },
});
```

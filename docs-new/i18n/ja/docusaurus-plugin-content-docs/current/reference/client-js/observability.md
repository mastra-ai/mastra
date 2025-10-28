---
title: Mastra クライアント向け Observability API
description: client-js SDK を使って AI のトレースを取得し、アプリケーションのパフォーマンスを監視し、トレースをスコアリングする方法を学びます。
---

# Observability API \{#observability-api\}

Observability API は、AI のトレースの取得、アプリケーションのパフォーマンス監視、評価用のトレース採点を行うためのメソッドを提供します。これにより、AI エージェントやワークフローのパフォーマンスを把握できます。

## 特定の AI トレースの取得 \{#getting-a-specific-ai-trace\}

ID を指定して特定の AI トレースを取得し、すべてのスパンと詳細を含めます。

```typescript
const trace = await mastraClient.getAITrace('trace-id-123');
```

## フィルタリング付きの AI トレース取得 \{#getting-ai-traces-with-filtering\}

オプションのフィルタを指定して、AI トレースのルートスパンをページネーションで一覧取得します。

```typescript
const traces = await mastraClient.getAITraces({
  pagination: {
    page: 1,
    perPage: 20,
    dateRange: {
      start: new Date('2024-01-01'),
      end: new Date('2024-01-31'),
    },
  },
  filters: {
    name: 'weather-agent', // トレース名でフィルター
    spanType: 'agent', // スパンタイプでフィルター
    entityId: 'weather-agent-id', // エンティティIDでフィルター
    entityType: 'agent', // エンティティタイプでフィルター
  },
});

console.log(`${traces.spans.length}個のルートスパンが見つかりました`);
console.log(`総ページ数: ${traces.pagination.totalPages}`);

// すべてのスパンを含む完全なトレースを取得するには、getAITraceを使用してください
const completeTrace = await mastraClient.getAITrace(traces.spans[0].traceId);
```

## トレースのスコアリング \{#scoring-traces\}

評価のために登録済みのスコアラーを使って、特定のトレースにスコアを付与します。

```typescript
const result = await mastraClient.score({
  scorerName: 'answer-relevancy',
  targets: [
    { traceId: 'trace-1', spanId: 'span-1' }, // 特定のスパンをスコアリング
    { traceId: 'trace-2' }, // 親スパンをスコアリング(デフォルト)
  ],
});
```

## スパン単位でスコアを取得 \{#getting-scores-by-span\}

トレース内の特定のスパンのスコアを取得します：

```typescript
const scores = await mastraClient.getScoresBySpan({
  traceId: 'trace-123',
  spanId: 'span-456',
  page: 1,
  perPage: 20,
});
```

## 関連情報 \{#related\}

* [Agents API](./agents) - トレースを生成するエージェントの動作・やり取りについて学ぶ
* [Workflows API](./workflows) - ワークフロー実行の監視について理解する
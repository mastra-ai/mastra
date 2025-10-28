---
title: Mastra クライアント向け Workflows API
description: client-js SDK を使って、Mastra で自動化ワークフローを操作・実行する方法を学びます。
---

# Workflows API \{#workflows-api\}

Workflows API は、Mastra で自動化ワークフローの操作や実行を行うための各種メソッドを提供します。

## すべてのワークフローの取得 \{#getting-all-workflows\}

利用可能なすべてのワークフローの一覧を取得します：

```typescript
const workflows = await mastraClient.getWorkflows();
```

## 特定のワークフローを扱う \{#working-with-a-specific-workflow\}

const 名で定義された特定のワークフローのインスタンスを取得します：

```typescript filename="src/mastra/workflows/test-workflow.ts"
export const testWorkflow = createWorkflow({
  id: 'city-workflow',
});
```

```typescript
const workflow = mastraClient.getWorkflow('testWorkflow');
```

## ワークフローのメソッド \{#workflow-methods\}

### ワークフローの詳細を取得 \{#get-workflow-details\}

ワークフローの詳細情報を取得します：

```typescript
const details = await workflow.details();
```

### ワークフロー実行を非同期で開始する \{#start-workflow-run-asynchronously\}

inputData を使ってワークフロー実行を開始し、実行が完了するまでの結果を待機します:

```typescript
const run = await workflow.createRunAsync();

const result = await run.startAsync({
  inputData: {
    city: 'New York',
  },
});
```

### ワークフローの実行を非同期で再開する \{#resume-workflow-run-asynchronously\}

一時停止中のワークフローステップを再開し、全体の実行結果が出るまで待機します。

```typescript
const run = await workflow.createRunAsync();

const result = await run.resumeAsync({
  step: 'step-id',
  resumeData: { key: 'value' },
});
```

### ウォッチ ワークフロー \{#watch-workflow\}

ウォッチ ワークフローの遷移:

```typescript
try {
  const workflow = mastraClient.getWorkflow('testWorkflow');

  const run = await workflow.createRunAsync();

  run.watch(record => {
    console.log(record);
  });

  const result = await run.start({
    inputData: {
      city: 'New York',
    },
  });
} catch (e) {
  console.error(e);
}
```

### ワークフローの再開 \{#resume-workflow\}

ワークフローの実行を再開し、ステップの遷移を監視します。

```typescript
try {
  const workflow = mastraClient.getWorkflow('testWorkflow');

  const run = await workflow.createRunAsync({ runId: prevRunId });

  run.watch(record => {
    console.log(record);
  });

  run.resume({
    step: 'step-id',
    resumeData: { key: 'value' },
  });
} catch (e) {
  console.error(e);
}
```

### ストリーミング ワークフロー \{#stream-workflow\}

リアルタイム更新のためにワークフローの実行をストリーミングします：

```typescript
try {
  const workflow = mastraClient.getWorkflow('testWorkflow');

  const run = await workflow.createRunAsync();

  const stream = await run.stream({
    inputData: {
      city: 'New York',
    },
  });

  for await (const chunk of stream) {
    console.log(JSON.stringify(chunk, null, 2));
  }
} catch (e) {
  console.error('ワークフローエラー:', e);
}
```

### ワークフロー実行の結果を取得 \{#get-workflow-run-result\}

ワークフロー実行の結果を取得します。

```typescript
try {
  const workflow = mastraClient.getWorkflow('testWorkflow');

  const run = await workflow.createRunAsync();

  // ワークフローの実行を開始
  const startResult = await run.start({
    inputData: {
      city: 'New York',
    },
  });

  const result = await workflow.runExecutionResult(run.runId);

  console.log(result);
} catch (e) {
  console.error(e);
}
```

これは、長時間実行されるワークフローを扱う際に便利です。これを使って、ワークフロー実行の結果をポーリングできます。

### ワークフロー実行結果 \{#workflow-run-result\}

ワークフローの実行結果は次のとおりです:

| フィールド       | 型                                                                                                                                                                                                                                                | 説明                                     |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `payload`        | `{currentStep?: {id: string, status: string, output?: Record<string, any>, payload?: Record<string, any>}, workflowState: {status: string, steps: Record<string, {status: string, output?: Record<string, any>, payload?: Record<string, any>}>}}` | 実行中のステップとワークフローの状態     |
| `eventTimestamp` | `Date`                                                                                                                                                                                                                                             | イベントのタイムスタンプ                 |
| `runId`          | `string`                                                                                                                                                                                                                                           | このワークフロー実行インスタンスの一意識別子 |
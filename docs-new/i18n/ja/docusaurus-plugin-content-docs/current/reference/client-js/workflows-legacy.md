---
title: Mastra クライアント ワークフロー（レガシー）API
description: client-js SDK を使用して、Mastra のレガシー自動ワークフローとの連携や実行方法を学びます。
---

# Workflows（レガシー）API \{#workflows-legacy-api\}

Workflows（レガシー）API は、Mastra のレガシー自動化ワークフローと連携し、実行するためのメソッドを提供します。

## すべてのレガシーワークフローの取得 \{#getting-all-legacy-workflows\}

利用可能なすべてのレガシーワークフローの一覧を取得します：

```typescript
const workflows = await mastraClient.getLegacyWorkflows();
```

## 特定のレガシー ワークフローを扱う \{#working-with-a-specific-legacy-workflow\}

特定のレガシー ワークフローのインスタンスを取得します：

```typescript
const workflow = mastraClient.getLegacyWorkflow('workflow-id');
```

## レガシーなワークフローのメソッド \{#legacy-workflow-methods\}

### レガシー ワークフローの詳細を取得 \{#get-legacy-workflow-details\}

レガシー ワークフローの詳細情報を取得します。

```typescript
const details = await workflow.details();
```

### レガシー Workflow の実行を非同期で開始 \{#start-legacy-workflow-run-asynchronously\}

triggerData を使ってレガシー Workflow の実行を開始し、完了まで待機して結果を取得します:

```typescript
const { runId } = workflow.createRun();

const result = await workflow.startAsync({
  runId,
  triggerData: {
    param1: 'value1',
    param2: 'value2',
  },
});
```

### レガシーワークフローの実行を非同期で再開する \{#resume-legacy-workflow-run-asynchronously\}

一時停止中のレガシー ワークフローのステップを再開し、最終的な実行結果が得られるまで待機します:

```typescript
const { runId } = createRun({ runId: prevRunId });

const result = await workflow.resumeAsync({
  runId,
  stepId: 'step-id',
  contextData: { key: 'value' },
});
```

### 旧式ワークフローを監視 \{#watch-legacy-workflow\}

旧式ワークフローの遷移を監視する

```typescript
try {
  // ワークフローインスタンスを取得
  const workflow = mastraClient.getLegacyWorkflow('workflow-id');

  // ワークフロー実行を作成
  const { runId } = workflow.createRun();

  // ワークフロー実行を監視
  workflow.watch({ runId }, record => {
    // 新しいレコードはすべて、ワークフロー実行の最新の遷移状態を表します

    console.log({
      activePaths: record.activePaths,
      results: record.results,
      timestamp: record.timestamp,
      runId: record.runId,
    });
  });

  // Start workflow run
  workflow.start({
    runId,
    triggerData: {
      city: 'New York',
    },
  });
} catch (e) {
  console.error(e);
}
```

### 旧ワークフローの再開 \{#resume-legacy-workflow\}

旧ワークフローの実行を再開し、ステップの遷移を監視します

```typescript
try {
  //ステップが中断された際に、ワークフロー実行を再開する
  const { run } = createRun({ runId: prevRunId });

  //実行を監視
  workflow.watch({ runId }, record => {
    // 各新しいレコードは、ワークフロー実行の最新の遷移状態を表します

    console.log({
      activePaths: record.activePaths,
      results: record.results,
      timestamp: record.timestamp,
      runId: record.runId,
    });
  });

  //実行を再開
  workflow.resume({
    runId,
    stepId: 'step-id',
    contextData: { key: 'value' },
  });
} catch (e) {
  console.error(e);
}
```

### レガシーワークフロー実行結果 \{#legacy-workflow-run-result\}

レガシーなワークフローの実行結果は次のとおりです:

| フィールド     | 型                                                                                | 説明                                                         |
| ------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `activePaths` | `Record<string, { status: string; suspendPayload?: any; stepPath: string[] }>`    | 実行ステータス付きの、ワークフロー内で現在アクティブなパス |
| `results`     | `LegacyWorkflowRunResult<any, any, any>['results']`                               | ワークフロー実行の結果                                      |
| `timestamp`   | `number`                                                                          | この遷移が発生した時刻の Unix タイムスタンプ                |
| `runId`       | `string`                                                                          | このワークフロー実行インスタンスの一意の識別子              |
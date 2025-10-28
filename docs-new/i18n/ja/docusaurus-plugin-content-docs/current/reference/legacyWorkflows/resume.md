---
title: "run.resume() "
description: ワークフローの`.resume()`メソッドに関するドキュメント。一時停止中のワークフローステップの実行を再開します。
---

# run.resume() \{#runresume\}

`.resume()` メソッドは、一時停止中のワークフローステップの実行を再開し、必要に応じて新しいコンテキストデータを渡します。渡されたデータは、そのステップの `inputData` プロパティから参照できます。

## 使い方 \{#usage\}

```typescript copy showLineNumbers
await run.resume({
  runId: 'abc-123',
  stepId: 'stepTwo',
  context: {
    secondValue: 100,
  },
});
```

## パラメータ \{#parameters\}

<PropertiesTable
  content={[
{
name: "config",
type: "object",
description: "ワークフローを再開するための設定",
isOptional: false,
},
]}
/>

### config \{#config\}

<PropertiesTable
  content={[
{
name: "runId",
type: "string",
description: "再開するワークフロー実行の一意識別子",
isOptional: false,
},
{
name: "stepId",
type: "string",
description: "再開する一時停止中のステップのID",
isOptional: false,
},
{
name: "context",
type: "Record<string, any>",
description:
"ステップのinputDataプロパティに注入する新しいコンテキストデータ",
isOptional: true,
},
]}
/>

## 戻り値 \{#returns\}

<PropertiesTable
  content={[
{
name: "Promise<LegacyWorkflowResult>",
type: "object",
description: "再開されたワークフロー実行の結果",
},
]}
/>

## Async/Await のフロー \{#asyncawait-flow\}

ワークフローが再開されると、ステップの実行関数内での `suspend()` 呼び出し直後の位置から処理が再開されます。これにより、コードに自然な流れが生まれます。

```typescript
// サスペンドポイントを持つステップ定義
const reviewStep = new LegacyStep({
  id: 'review',
  execute: async ({ context, suspend }) => {
    // 実行の最初の部分
    const initialAnalysis = analyzeData(context.inputData.data);

    if (initialAnalysis.needsReview) {
      // ここで実行を一時停止
      await suspend({ analysis: initialAnalysis });

      // このコードはresume()が呼び出された後に実行されます
      // context.inputDataには、resume時に提供されたデータが含まれます
      return {
        reviewedData: enhanceWithFeedback(initialAnalysis, context.inputData.feedback),
      };
    }

    return { reviewedData: initialAnalysis };
  },
});

const { runId, resume, start } = workflow.createRun();

await start({
  inputData: {
    data: 'サンプルデータ',
  },
});

// 後でワークフローを再開
const result = await resume({
  runId: 'workflow-123',
  stepId: 'review',
  context: {
    // このデータは`context.inputData`で利用可能になります
    feedback: '良いですが、セクション3を改善してください',
  },
});
```

### 実行フロー \{#execution-flow\}

1. ワークフローは `review` ステップ内の `await suspend()` に到達するまで実行されます
2. ワークフローの状態が永続化され、実行が一時停止します
3. 後に、新しいコンテキストデータとともに `run.resume()` が呼び出されます
4. 実行は `review` ステップ内の `suspend()` の直後の地点から再開されます
5. 新しいコンテキストデータ（`feedback`）は、そのステップの `inputData` プロパティから参照できます
6. ステップが完了し、結果を返します
7. ワークフローは後続のステップへと進みます

## エラーハンドリング \{#error-handling\}

resume 関数は、複数の種類のエラーを送出する可能性があります:

```typescript
try {
  await run.resume({
    runId,
    stepId: 'stepTwo',
    context: newData,
  });
} catch (error) {
  if (error.message === 'No snapshot found for workflow run') {
    // ワークフロー状態が見つからない場合の処理
  }
  if (error.message === 'Failed to parse workflow snapshot') {
    // ワークフロー状態が破損している場合の処理
  }
}
```

## 関連情報 \{#related\}

* [Suspend と Resume](/docs/examples/workflows_legacy/suspend-and-resume)
* [`suspend` リファレンス](./suspend)
* [`watch` リファレンス](./watch)
* [Workflow クラスリファレンス](./workflow)
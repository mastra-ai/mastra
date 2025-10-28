---
title: "Workflow.createRun() "
description: "ワークフロー（旧版）での`.createRun()`メソッドのドキュメント。新しいワークフロー実行インスタンスを初期化します。"
---

# Workflow.createRun() \{#workflowcreaterun\}

`.createRun()` メソッドは、新しいワークフロー実行インスタンスを初期化します。追跡用の一意の実行 ID を生成し、呼び出すとワークフローの実行を開始する start 関数を返します。

`.execute()` ではなく `.createRun()` を使う理由のひとつは、追跡やログ記録、あるいは `.watch()` による購読のために、一意の実行 ID を取得できる点です。

## 使い方 \{#usage\}

```typescript
const { runId, start, watch } = workflow.createRun();

const result = await start();
```

## 返り値 \{#returns\}

<PropertiesTable
  content={[
{
name: "runId",
type: "string",
description: "このワークフロー実行を追跡するための一意の識別子",
},
{
name: "start",
type: "() => Promise<LegacyWorkflowResult>",
description: "呼び出すとワークフローの実行を開始する関数",
},
{
name: "watch",
type: "(callback: (record: LegacyWorkflowResult) => void) => () => void",
description:
"ワークフロー実行の各遷移ごとに呼び出されるコールバックを受け取る関数",
},
{
name: "resume",
type: "({stepId: string, context: Record<string, any>}) => Promise<LegacyWorkflowResult>",
description:
"指定したステップ ID とコンテキストからワークフロー実行を再開する関数",
},
{
name: "resumeWithEvent",
type: "(eventName: string, data: any) => Promise<LegacyWorkflowResult>",
description:
"指定したイベント名とデータからワークフロー実行を再開する関数",
},
]}
/>

## エラーハンドリング \{#error-handling\}

ワークフロー設定が無効な場合、start 関数が検証エラーをスローすることがあります。

```typescript
try {
  const { runId, start, watch, resume, resumeWithEvent } = workflow.createRun();
  await start({ triggerData: data });
} catch (error) {
  if (error instanceof ValidationError) {
    // バリデーションエラーを処理する
    console.log(error.type); // 'circular_dependency' | 'no_terminal_path' | 'unreachable_step'
    console.log(error.details);
  }
}
```

## 関連 \{#related\}

* [Workflow クラス リファレンス](./workflow)
* [Step クラス リファレンス](./step-class)
* 詳細な使用方法については、[Creating a Workflow](/docs/examples/workflows_legacy/creating-a-workflow) の例を参照してください
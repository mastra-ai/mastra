---
title: "Workflow クラス"
description: Mastra の Workflow クラスに関するドキュメント。条件分岐やデータ検証を伴う複雑な処理フローに対して、ステートマシンを構築できます。
---

# Workflow クラス \{#workflow-class\}

Workflow クラスは、条件分岐やデータ検証を伴う複雑な一連の処理のためのステートマシンを作成できるようにします。

```ts copy
import { LegacyWorkflow } from '@mastra/core/workflows/legacy';

const workflow = new LegacyWorkflow({ name: 'my-workflow' });
```

## API リファレンス \{#api-reference\}

### コンストラクタ \{#constructor\}

<PropertiesTable
  content={[
{
name: "name",
type: "string",
description: "ワークフローの識別子",
},
{
name: "logger",
type: "Logger<WorkflowLogMessage>",
isOptional: true,
description: "ワークフロー実行の詳細を記録するための任意のロガーインスタンス",
},
{
name: "steps",
type: "Step[]",
description: "ワークフローに含めるステップの配列",
},
{
name: "triggerSchema",
type: "z.Schema",
description: "ワークフローのトリガー用データを検証するための任意のスキーマ",
},
]}
/>

### コアメソッド \{#core-methods\}

#### `step()` \{#step\}

ワークフローに[Step](./step-class)を追加し、他のステップへの遷移も定義します。メソッドチェーンのためにワークフローインスタンスを返します。[ステップの詳細](./step-class)。

#### `commit()` \{#commit\}

ワークフロー設定を検証して確定します。すべてのステップを追加した後に呼び出す必要があります。

#### `execute()` \{#execute\}

オプションのトリガーデータとともにワークフローを実行します。型は [トリガースキーマ](./workflow#trigger-schemas) に基づきます。

## トリガースキーマ \{#trigger-schemas\}

トリガースキーマは、Zod を使ってワークフローに渡される初期データを検証します。

```ts showLineNumbers copy
const workflow = new LegacyWorkflow({
  name: 'order-process',
  triggerSchema: z.object({
    orderId: z.string(),
    customer: z.object({
      id: z.string(),
      email: z.string().email(),
    }),
  }),
});
```

The schema:

* `execute()` に渡すデータを検証します
* ワークフロー入力のための TypeScript 型を提供します

## 検証 \{#validation\}

ワークフローの検証は主に次の2つのタイミングで行われます：

### 1. コミット時 \{#1-at-commit-time\}

`.commit()` を呼び出すと、ワークフローは次の点を検証します：

```ts showLineNumbers copy
workflow
  .step('step1', {...})
  .step('step2', {...})
  .commit(); // ワークフローの構造を検証する
```

* ステップ間の循環依存
* 終端パス（すべてのパスは必ず終端に至ること）
* 到達不能なステップ
* 存在しないステップを参照する変数
* 重複したステップID

### 2. 実行時 \{#2-during-execution\}

`start()` を呼び出すと、次の点を検証します:

```ts showLineNumbers copy
const { runId, start } = workflow.createRun();

// トリガーデータをスキーマで検証します
await start({
  triggerData: {
    orderId: '123',
    customer: {
      id: 'cust_123',
      email: 'invalid-email', // 検証に失敗します
    },
  },
});
```

* トリガーのデータがトリガーのスキーマに準拠している
* 各ステップの入力データがその`inputSchema`に準拠している
* 参照先のステップ出力に変数パスが存在している
* 必須の変数が存在している

## ワークフローのステータス \{#workflow-status\}

ワークフローのステータスは現在の実行状況を示します。取りうる値は次のとおりです：

<PropertiesTable
  content={[
{
name: "CREATED",
type: "string",
description: "ワークフローインスタンスは作成されたが、まだ開始されていない",
},
{
name: "RUNNING",
type: "string",
description: "ワークフローがステップを実行中",
},
{
name: "SUSPENDED",
type: "string",
description: "ワークフローの実行が一時停止され、再開待ち",
},
{
name: "COMPLETED",
type: "string",
description: "すべてのステップが正常に完了した",
},
{
name: "FAILED",
type: "string",
description: "実行中にエラーが発生した",
},
]}
/>

### 例: ステータス別の処理 \{#example-handling-different-statuses\}

```typescript showLineNumbers copy
const { runId, start, watch } = workflow.createRun();

watch(async ({ status }) => {
  switch (status) {
    case 'SUSPENDED':
      // 一時停止中の処理
      break;
    case 'COMPLETED':
      // 結果の処理
      break;
    case 'FAILED':
      // エラー時の処理
      break;
  }
});

await start({ triggerData: data });
```

## エラー ハンドリング \{#error-handling\}

```ts showLineNumbers copy
try {
  const { runId, start, watch, resume } = workflow.createRun();
  await start({ triggerData: data });
} catch (error) {
  if (error instanceof ValidationError) {
    // バリデーションエラーを処理する
    console.log(error.type); // 'circular_dependency' | 'no_terminal_path' | 'unreachable_step'
    console.log(error.details); // { stepId?: string, path?: string[] }
  }
}
```

## ステップ間でのコンテキストの受け渡し \{#passing-context-between-steps\}

ステップは `context` オブジェクトを通じて、ワークフロー内の前のステップのデータにアクセスできます。各ステップは、これまでに実行されたすべての前段ステップから蓄積された `context` を受け取ります。

```typescript showLineNumbers copy
workflow
  .step({
    id: 'getData',
    execute: async ({ context }) => {
      return {
        data: { id: '123', value: 'example' },
      };
    },
  })
  .step({
    id: 'processData',
    execute: async ({ context }) => {
      // context.steps を介して前のステップのデータにアクセスする
      const previousData = context.steps.getData.output.data;
      // previousData.id と previousData.value を処理する
    },
  });
```

The context object:

* `context.steps` には、完了したすべてのステップの結果が含まれます
* `context.steps.[stepId].output` からステップの出力にアクセスできます
* ステップの出力スキーマに基づいて型付けされています
* データの一貫性を保つためにイミュータブル（不変）です

## 関連ドキュメント \{#related-documentation\}

* [Step](./step-class)
* [.then()](./then)
* [.step()](./step-function)
* [.after()](./after)
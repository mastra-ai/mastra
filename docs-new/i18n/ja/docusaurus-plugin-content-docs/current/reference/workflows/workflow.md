---
title: "Workflow クラス"
description: Mastra の `Workflow` クラスに関するドキュメント。条件分岐やデータ検証を伴う複雑な処理フロー向けに、ステートマシンを構築できる機能を提供します。
---

# Workflow クラス \{#workflow-class\}

`Workflow` クラスを使うと、条件分岐やデータ検証を含む複雑な処理の流れに対してステートマシンを作成できます。

## 使い方の例 \{#usage-example\}

```typescript filename="src/mastra/workflows/test-workflow.ts" showLineNumbers copy
import { createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

export const workflow = createWorkflow({
  id: 'test-workflow',
  inputSchema: z.object({
    value: z.string(),
  }),
  outputSchema: z.object({
    value: z.string(),
  }),
});
```

## コンストラクターのパラメーター \{#constructor-parameters\}

<PropertiesTable
  content={[
{
name: "id",
type: "string",
description: "ワークフローの一意の識別子",
},
{
name: "inputSchema",
type: "z.ZodType<any>",
description: "ワークフローの入力構造を定義する Zod スキーマ",
},
{
name: "outputSchema",
type: "z.ZodType<any>",
description: "ワークフローの出力構造を定義する Zod スキーマ",
},
{
name: "stateSchema",
type: "z.ZodObject<any>",
description: "ワークフローの状態を表す任意の Zod スキーマ。Mastra の状態管理を使用する場合は自動的に挿入されます。指定しない場合、型は「any」になります。",
isOptional: true,
},
]}
/>

## ワークフローのステータス \{#workflow-status\}

ワークフローの`status`は現在の実行状態を示します。取りうる値は次のとおりです：

<PropertiesTable
  content={[
{
name: "success",
type: "string",
description:
"すべてのステップが正常に完了し、有効な結果が出力された",
},
{
name: "failed",
type: "string",
description:
"実行中にエラーが発生し、エラーの詳細を参照できる",
},
{
name: "suspended",
type: "string",
description:
"ワークフローの実行が一時停止され、再開待ちで、中断されたステップ情報がある",
},
]}
/>

## 発展的な使用例 \{#extended-usage-example\}

```typescript filename="src/test-run.ts" showLineNumbers copy
import { mastra } from "./mastra";

const run = await mastra.getWorkflow("workflow").createRunAsync();

const result = await run.start({...});

if (result.status === "suspended") {
  const resumedResult = await run.resume({...});
}
```

## 関連項目 \{#related\}

* [Step クラス](./step)
* [制御フロー](/docs/workflows/control-flow)
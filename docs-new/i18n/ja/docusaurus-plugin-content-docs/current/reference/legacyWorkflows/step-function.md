---
title: "Workflow.step()"
description: ワークフローに新しいステップを追加する `.step()` メソッドのドキュメントです。
---

# Workflow.step() \{#workflowstep\}

`.step()` メソッドは、ワークフローに新たなステップを追加し、必要に応じてその変数や実行条件を設定します。

## 使い方 \{#usage\}

```typescript
workflow.step({
  id: 'stepTwo',
  outputSchema: z.object({
    result: z.number(),
  }),
  execute: async ({ context }) => {
    return { result: 42 };
  },
});
```

## パラメータ \{#parameters\}

<PropertiesTable
  content={[
{
name: "stepConfig",
type: "Step | StepDefinition | string",
description:
"ワークフローに追加する Step インスタンス、構成オブジェクト、またはステップ ID",
isOptional: false,
},
{
name: "options",
type: "StepOptions",
description: "ステップ実行のオプション構成",
isOptional: true,
},
]}
/>

### StepDefinition \{#stepdefinition\}

<PropertiesTable
  content={[
{
name: "id",
type: "string",
description: "ステップの一意の識別子",
isOptional: false,
},
{
name: "outputSchema",
type: "z.ZodSchema",
description: "ステップの出力を検証するためのスキーマ",
isOptional: true,
},
{
name: "execute",
type: "(params: ExecuteParams) => Promise<any>",
description: "ステップの処理ロジックを実装する関数",
isOptional: false,
},
]}
/>

### StepOptions \{#stepoptions\}

<PropertiesTable
  content={[
{
name: "variables",
type: "Record<string, VariableRef>",
description: "変数名とその参照元のマッピング",
isOptional: true,
},
{
name: "when",
type: "StepCondition",
description: "ステップを実行するために満たすべき条件",
isOptional: true,
},
]}
/>

## 関連項目 \{#related\}

* [ステップインスタンスの基本的な使い方](/docs/workflows/overview)
* [Step クラス リファレンス](./step-class)
* [Workflow クラス リファレンス](./workflow)
* [制御フロー ガイド](/docs/workflows/control-flow)
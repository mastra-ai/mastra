---
title: "StepOptions "
description: ワークフロー内のステップオプションに関するドキュメント。変数のマッピング、実行条件、その他の実行時の動作を制御します。
---

# StepOptions \{#stepoptions\}

変数のマッピング、実行条件、その他のランタイム動作を制御するワークフローのステップ向け設定オプション。

## 使い方 \{#usage\}

```typescript
workflow.step(processOrder, {
  variables: {
    orderId: { step: 'trigger', path: 'id' },
    userId: { step: 'auth', path: 'user.id' },
  },
  when: {
    ref: { step: 'auth', path: 'status' },
    query: { $eq: 'authenticated' },
  },
});
```

## プロパティ \{#properties\}

<PropertiesTable
  content={[
{
name: "variables",
type: "Record<string, VariableRef>",
description: "ステップの入力変数を他のステップの値に対応付けます",
isOptional: true,
},
{
name: "when",
type: "StepCondition",
description: "ステップを実行するために満たす必要がある条件",
isOptional: true,
},
]}
/>

### VariableRef \{#variableref\}

<PropertiesTable
  content={[
{
name: "step",
type: "string | Step | { id: string }",
description: "変数値の参照元となるステップ",
isOptional: false,
},
{
name: "path",
type: "string",
description: "ステップの出力内にある値へのパス",
isOptional: false,
},
]}
/>

## 関連情報 \{#related\}

* [パス比較](/docs/workflows/control-flow)
* [Step 関数リファレンス](./step-function)
* [Step クラスリファレンス](./step-class)
* [Workflow クラスリファレンス](./workflow)
* [制御フローガイド](/docs/workflows/control-flow)
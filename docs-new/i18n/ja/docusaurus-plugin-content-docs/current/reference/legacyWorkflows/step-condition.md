---
title: "StepCondition "
description: ワークフローにおけるステップ条件クラスのドキュメント。前のステップの出力やトリガー データに基づいて、ステップを実行するかどうかを判定します。
---

# StepCondition \{#stepcondition\}

条件は、前のステップの出力やトリガー データに基づいて、そのステップを実行するかどうかを判定します。

## 使い方 \{#usage\}

条件の指定方法は、関数、クエリオブジェクト、シンプルなパス比較の3通りがあります。

### 1. 関数の条件 \{#1-function-condition\}

```typescript copy showLineNumbers
workflow.step(processOrder, {
  when: async ({ context }) => {
    const auth = context?.getStepResult<{ status: string }>('auth');
    return auth?.status === 'authenticated';
  },
});
```

### 2. クエリ オブジェクト \{#2-query-object\}

```typescript copy showLineNumbers
workflow.step(processOrder, {
  when: {
    ref: { step: 'auth', path: 'status' },
    query: { $eq: 'authenticated' },
  },
});
```

### 3. 単純なパス比較 \{#3-simple-path-comparison\}

```typescript copy showLineNumbers
workflow.step(processOrder, {
  when: {
    'auth.status': 'authenticated',
  },
});
```

条件の種類に応じて、ワークフローランナーはその条件を次のいずれかのタイプとして解釈しようとします。

1. シンプルなパス条件（キーにドットが含まれている場合）
2. Base/Query 条件（&quot;ref&quot; プロパティがある場合）
3. 関数条件（非同期関数である場合）

## StepCondition \{#stepcondition\}

<PropertiesTable
  content={[
{
name: "ref",
type: "{ stepId: string | 'trigger'; path: string }",
description:
"ステップ出力値への参照。stepId にはステップ ID、または初期データの場合は 'trigger' を指定します。path はステップ結果内の値の位置を指定します",
isOptional: false,
},
{
name: "query",
type: "Query<any>",
description: "sift オペレーター（$eq、$gt など）を用いる MongoDB 形式のクエリ",
isOptional: false,
},
]}
/>

## クエリ \{#query\}

Query オブジェクトは、前のステップやトリガー データの値を比較するための、MongoDB 形式のクエリ演算子を提供します。基本的な比較演算子の `$eq`、`$gt`、`$lt` に加えて、配列演算子の `$in` や `$nin` をサポートし、and/or 演算子と組み合わせて複雑な条件を表現できます。

このクエリ構文により、ステップを実行すべきかどうかを判断するための、読みやすい条件ロジックを記述できます。

<PropertiesTable
  content={[
{
name: "$eq",
    type: "any",
    description: "値と等しい",
  },
  {
    name: "$ne",
type: "any",
description: "値と等しくない",
},
{
name: "$gt",
    type: "number",
    description: "値より大きい",
  },
  {
    name: "$gte",
type: "number",
description: "値以上",
},
{
name: "$lt",
    type: "number",
    description: "値より小さい",
  },
  {
    name: "$lte",
type: "number",
description: "値以下",
},
{
name: "$in",
    type: "any[]",
    description: "配列内に値が存在する",
  },
  {
    name: "$nin",
type: "any[]",
description: "配列内に値が存在しない",
},
{
name: "and",
type: "StepCondition[]",
description: "すべてが true である必要がある条件の配列",
},
{
name: "or",
type: "StepCondition[]",
description: "少なくとも一つが true である必要がある条件の配列",
},
]}
/>

## 関連項目 \{#related\}

* [ステップオプション リファレンス](./step-options)
* [ステップ関数 リファレンス](./step-function)
* [制御フロー ガイド](/docs/workflows/control-flow)
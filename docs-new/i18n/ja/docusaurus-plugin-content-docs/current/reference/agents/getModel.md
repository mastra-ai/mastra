---
title: "Agent.getModel() "
description: "Mastra のエージェントにおける `Agent.getModel()` メソッドのドキュメント。エージェントを駆動する言語モデルを取得します。"
---

# Agent.getModel() \{#agentgetmodel\}

`.getModel()` メソッドは、エージェントに設定された言語モデルを取得し、それが関数である場合は実体化（解決）します。このメソッドは、エージェントの機能を支える基盤となるモデルにアクセスするために使用されます。

## 使い方の例 \{#usage-example\}

```typescript copy
await agent.getModel();
```

## パラメータ \{#parameters\}

<PropertiesTable
  content={[
{
name: "{ runtimeContext = new RuntimeContext() }",
type: "{ runtimeContext?: RuntimeContext }",
isOptional: true,
defaultValue: "new RuntimeContext()",
description: "ランタイムコンテキストを含む任意の構成オブジェクト（省略可）。",
},
]}
/>

## 戻り値 \{#returns\}

<PropertiesTable
  content={[
{
name: "model",
type: "MastraLanguageModel | Promise<MastraLanguageModel>",
description: "エージェントに設定された言語モデル。モデルのインスタンス、または最終的にそのモデルへ解決される Promise のいずれかです。",
},
]}
/>

## 拡張的な使用例 \{#extended-usage-example\}

```typescript copy
await agent.getModel({
  runtimeContext: new RuntimeContext(),
});
```

### オプションパラメータ \{#options-parameters\}

<PropertiesTable
  content={[
{
name: "runtimeContext",
type: "RuntimeContext",
isOptional: true,
defaultValue: "undefined",
description: "依存性注入やコンテキスト情報のためのランタイムコンテキスト。",
},
]}
/>

## 関連項目 \{#related\}

* [Agents の概要](/docs/agents/overview)
* [エージェントのランタイムコンテキスト](/docs/server-db/runtime-context)
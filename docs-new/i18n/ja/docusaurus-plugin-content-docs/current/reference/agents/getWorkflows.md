---
title: "Agent.getWorkflows()"
description: "Mastra のエージェントにおける `Agent.getWorkflows()` メソッドのドキュメント。エージェントが実行可能なワークフローを取得します。"
---

# Agent.getWorkflows() \{#agentgetworkflows\}

`.getWorkflows()` メソッドは、エージェントに設定されたワークフローを取得し、関数として定義されている場合はそれを解決します。これらのワークフローにより、エージェントは定義済みの実行パスに従って、複雑な多段階の処理を実行できます。

## 使い方の例 \{#usage-example\}

```typescript copy
await agent.getWorkflows();
```

## パラメータ \{#parameters\}

<PropertiesTable
  content={[
{
name: "options",
type: "{ runtimeContext?: RuntimeContext }",
isOptional: true,
defaultValue: "{}",
description: "ランタイムコンテキストを含むオプションの設定オブジェクト。",
},
]}
/>

## 返り値 \{#returns\}

<PropertiesTable
  content={[
{
name: "workflows",
type: "Promise<Record<string, Workflow>>",
description: "ワークフロー名をキー、対応する Workflow インスタンスを値とするレコードへと解決される Promise。",
},
]}
/>

## 拡張された使用例 \{#extended-usage-example\}

```typescript copy
await agent.getWorkflows({
  runtimeContext: new RuntimeContext(),
});
```

### オプションのパラメータ \{#options-parameters\}

<PropertiesTable
  content={[
{
name: "runtimeContext",
type: "RuntimeContext",
isOptional: true,
defaultValue: "new RuntimeContext()",
description: "依存性の注入やコンテキスト情報のためのランタイムコンテキスト。",
},
]}
/>

## 関連項目 \{#related\}

* [エージェントの概要](/docs/agents/overview)
* [ワークフローの概要](/docs/workflows/overview)
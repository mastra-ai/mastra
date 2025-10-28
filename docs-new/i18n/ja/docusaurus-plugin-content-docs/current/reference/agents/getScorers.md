---
title: "Agent.getScorers()"
description: "Mastra エージェントの `Agent.getScorers()` メソッドのドキュメント。スコアリング構成を取得します。"
---

# Agent.getScorers() \{#agentgetscorers\}

`.getScorers()` メソッドは、エージェントに設定されたスコアリング構成を取得し、それが関数の場合は評価して解決します。このメソッドにより、エージェントの応答やパフォーマンスを評価するために使用されるスコアリングシステムにアクセスできます。

## 使い方の例 \{#usage-example\}

```typescript copy
await agent.getScorers();
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

## 戻り値 \{#returns\}

<PropertiesTable
  content={[
{
name: "scorers",
type: "MastraScorers | Promise<MastraScorers>",
description: "エージェントに設定されたスコアリング構成。MastraScorers のオブジェクト、または MastraScorers に解決される Promise として返されます。",
},
]}
/>

## 拡張された使用例 \{#extended-usage-example\}

```typescript copy
await agent.getScorers({
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
description: "依存性注入とコンテキスト情報のためのランタイムコンテキスト。",
},
]}
/>

## 関連項目 \{#related\}

* [Agents の概要](/docs/agents/overview)
* [Agent ランタイムコンテキスト](/docs/server-db/runtime-context)
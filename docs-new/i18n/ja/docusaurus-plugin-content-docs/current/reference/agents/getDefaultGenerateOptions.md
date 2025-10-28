---
title: "Agent.getDefaultGenerateOptions() "
description: "Mastra のエージェントにおける `Agent.getDefaultGenerateOptions()` メソッドのドキュメント。generate 呼び出しで使用されるデフォルトオプションを取得します。"
---

# Agent.getDefaultGenerateOptions() \{#agentgetdefaultgenerateoptions\}

エージェントは、モデルの動作、出力のフォーマット、ツールやワークフローの呼び出しを制御するためのデフォルト生成オプションを設定できます。`.getDefaultGenerateOptions()` メソッドは、これらのデフォルトを取得し、関数であれば評価して解決します。これらのオプションは、上書きされない限りすべての `generate()` 呼び出しに適用され、エージェントに設定された未確認のデフォルトを確認するのに役立ちます。

## 使い方の例 \{#usage-example\}

```typescript copy
await agent.getDefaultGenerateOptions();
```

## パラメータ \{#parameters\}

<PropertiesTable
  content={[
{
name: "options",
type: "{ runtimeContext?: RuntimeContext }",
isOptional: true,
defaultValue: "{}",
description: "ランタイムコンテキストを含む任意の設定オブジェクト（省略可）。",
},
]}
/>

## 戻り値 \{#returns\}

<PropertiesTable
  content={[
{
name: "defaultOptions",
type: "AgentGenerateOptions | Promise<AgentGenerateOptions>",
description: "エージェントに設定されたデフォルトの生成オプション。オブジェクトそのもの、またはそのオプションに解決される Promise のいずれか。",
},
]}
/>

## 拡張された使用例 \{#extended-usage-example\}

```typescript copy
await agent.getDefaultGenerateOptions({
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

## 関連情報 \{#related\}

* [エージェントの応答生成](/docs/agents/overview#generating-responses)
* [エージェントランタイムコンテキスト](/docs/server-db/runtime-context)
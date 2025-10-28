---
title: "Agent.getDefaultStreamOptions() "
description: "Mastra のエージェントにおける `Agent.getDefaultStreamOptions()` メソッドのドキュメント。ストリーム呼び出しで使用される既定のオプションを取得します。"
---

# Agent.getDefaultStreamOptions() \{#agentgetdefaultstreamoptions\}

エージェントは、メモリ使用量、出力形式、反復ステップ向けのストリーミング既定値を設定できます。`.getDefaultStreamOptions()` メソッドは、これらの既定値を返し、関数の場合は解決した結果を返します。これらのオプションは、上書きされない限りすべての `stream()` 呼び出しに適用され、エージェントの未知の既定値を確認するのに役立ちます。

## 使い方の例 \{#usage-example\}

```typescript copy
await agent.getDefaultStreamOptions();
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
name: "defaultOptions",
type: "AgentExecutionOptions<Output, StructuredOutput> | Promise<AgentExecutionOptions<Output, StructuredOutput>>",
description: "エージェントに構成された vNext ストリーミングの既定オプション。オプションそのもののオブジェクト、またはそのオプションに解決される Promise のいずれかです。",
},
]}
/>

## 発展的な使用例 \{#extended-usage-example\}

```typescript copy
await agent.getDefaultStreamOptions({
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
defaultValue: "new RuntimeContext()",
description: "依存性注入とコンテキスト情報のための実行時コンテキスト。",
},
]}
/>

## 関連項目 \{#related\}

* [エージェントでのストリーミング](/docs/streaming/overview#streaming-with-agents)
* [エージェントのランタイムコンテキスト](/docs/server-db/runtime-context)
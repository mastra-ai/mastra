---
title: "Agent.getLLM() "
description: "Mastra エージェントの `Agent.getLLM()` メソッドに関するドキュメント。言語モデルのインスタンスを取得します。"
---

# Agent.getLLM() \{#agentgetllm\}

`.getLLM()` メソッドは、エージェントに設定された言語モデルのインスタンスを取得し、それが関数である場合は評価して解決します。このメソッドにより、エージェントの機能を支える基盤となる LLM へアクセスできます。

## 使い方の例 \{#usage-example\}

```typescript copy
await agent.getLLM();
```

## パラメータ \{#parameters\}

<PropertiesTable
  content={[
{
name: "options",
type: "{ runtimeContext?: RuntimeContext; model?: MastraLanguageModel | DynamicArgument<MastraLanguageModel> }",
isOptional: true,
defaultValue: "{}",
description: "ランタイムコンテキストとモデルの上書き（任意）を含むオプションの設定オブジェクト。",
},
]}
/>

## 返り値 \{#returns\}

<PropertiesTable
  content={[
{
name: "llm",
type: "MastraLLMV1 | Promise<MastraLLMV1>",
description: "エージェント向けに構成された言語モデルのインスタンス。直接のインスタンス、または LLM に解決される Promise のいずれかです。",
},
]}
/>

## 追加の使用例 \{#extended-usage-example\}

```typescript copy
await agent.getLLM({
  runtimeContext: new RuntimeContext(),
  model: openai('gpt-4'),
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
description: "依存性の注入とコンテキスト情報のための実行時コンテキスト。",
},
{
name: "model",
type: "MastraLanguageModel | DynamicArgument<MastraLanguageModel>",
isOptional: true,
description: "モデルの任意指定。指定された場合、エージェントで設定されたモデルではなく、このモデルが使用されます。",
},
]}
/>

## 関連情報 \{#related\}

* [エージェントの概要](/docs/agents/overview)
* [エージェントのランタイムコンテキスト](/docs/server-db/runtime-context)
---
title: "Agent.getInstructions() "
description: "Mastra のエージェントにおける `Agent.getInstructions()` メソッドのドキュメント。エージェントの動作を導く指示文（インストラクション）を取得します。"
---

# Agent.getInstructions() \{#agentgetinstructions\}

`.getInstructions()` メソッドは、エージェントに設定された指示を取得し、それが関数である場合は評価して解決します。これらの指示はエージェントの振る舞いを規定し、機能と制約を定義します。

## 使い方の例 \{#usage-example\}

```typescript copy
await agent.getInstructions();
```

## パラメーター \{#parameters\}

<PropertiesTable
  content={[
{
name: "options",
type: "{ runtimeContext?: RuntimeContext }",
isOptional: true,
defaultValue: "{}",
description: "ランタイムコンテキストを含む任意の構成オブジェクト。",
},
]}
/>

## 戻り値 \{#returns\}

<PropertiesTable
  content={[
{
name: "instructions",
type: "SystemMessage | Promise<SystemMessage>",
description: "エージェントに設定された指示。SystemMessage は次のいずれかになり得ます: string | string[] | CoreSystemMessage | CoreSystemMessage[] | SystemModelMessage | SystemModelMessage[]。値を直接返すか、指示に解決される Promise として返されます。",
},
]}
/>

## 拡張された使用例 \{#extended-usage-example\}

```typescript copy
await agent.getInstructions({
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
defaultValue: "undefined",
description: "依存性注入とコンテキスト情報のためのランタイムコンテキスト。",
},
]}
/>

## 関連情報 \{#related\}

* [エージェントの概要](/docs/agents/overview)
* [エージェントのランタイムコンテキスト](/docs/server-db/runtime-context)
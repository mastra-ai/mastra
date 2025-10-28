---
title: "Agent.getTools() "
description: "Mastra エージェントの `Agent.getTools()` メソッドに関するドキュメント。エージェントが使用可能なツールを取得します。"
---

# Agent.getTools() \{#agentgettools\}

`.getTools()` メソッドは、エージェントに設定されたツールを取得し、ツールが関数である場合は評価して実体化します。これらのツールはエージェントの機能を拡張し、特定のアクションの実行や外部システムへのアクセスを可能にします。

## 使い方の例 \{#usage-example\}

```typescript copy
await agent.getTools();
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

## 返却値 \{#returns\}

<PropertiesTable
  content={[
{
name: "tools",
type: "TTools | Promise<TTools>",
description: "エージェントに設定されたツール。ツールのオブジェクトそのもの、またはツールに解決される Promise として指定できます。",
},
]}
/>

## 発展的な使用例 \{#extended-usage-example\}

```typescript copy
await agent.getTools({
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
description: "依存性注入およびコンテキスト情報のためのランタイムコンテキスト。",
},
]}
/>

## 関連情報 \{#related\}

* [エージェントによるツールの利用](/docs/agents/using-tools-and-mcp)
* [ツールの作成](/docs/tools-mcp/overview)
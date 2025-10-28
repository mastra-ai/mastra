---
title: "Agent.getAgent()"
description: "Mastra の `Agent.getAgent()` メソッドに関するドキュメント。エージェントを名前で取得します。"
---

# Mastra.getAgent() \{#mastragetagent\}

`.getAgent()` メソッドはエージェントを取得するために使用します。引数としてエージェント名を表す単一の `string` を受け取ります。

## 使い方の例 \{#usage-example\}

```typescript copy
mastra.getAgent('testAgent');
```

## パラメータ \{#parameters\}

<PropertiesTable
  content={[
{
name: "name",
type: "TAgentName extends keyof TAgents",
description: "取得するエージェントの名前。Mastra の構成に存在する有効なエージェント名である必要があります。",
},
]}
/>

## 戻り値 \{#returns\}

<PropertiesTable
  content={[
{
name: "agent",
type: "TAgents[TAgentName]",
description: "指定した名前のエージェントのインスタンス。該当するエージェントが見つからない場合はエラーをスローします。",
},
]}
/>

## 関連項目 \{#related\}

* [エージェントの概要](/docs/agents/overview)
* [ランタイムコンテキスト](/docs/server-db/runtime-context)
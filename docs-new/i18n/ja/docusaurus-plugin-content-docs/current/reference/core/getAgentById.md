---
title: "Mastra.getAgentById() "
description: "Mastra の `Mastra.getAgentById()` メソッドのドキュメント。ID を指定してエージェントを取得します。"
---

# Mastra.getAgentById() \{#mastragetagentbyid\}

`.getAgentById()` メソッドは、ID でエージェントを取得します。エージェントの ID を表す `string` 型の引数を 1 つ受け取ります。

## 使い方の例 \{#usage-example\}

```typescript copy
mastra.getAgentById('test-agent-123');
```

## パラメーター \{#parameters\}

<PropertiesTable
  content={[
{
name: "id",
type: "string",
description: "取得するエージェントのID。まずこのIDでエージェントを検索し、見つからない場合は、そのIDを名前として扱って getAgent() を呼び出します。",
},
]}
/>

## 戻り値 \{#returns\}

<PropertiesTable
  content={[
{
name: "agent",
type: "Agent",
description: "指定したIDのエージェントインスタンス。見つからない場合はエラーをスローします。",
},
]}
/>

## 関連項目 \{#related\}

* [Agents の概要](/docs/agents/overview)
* [ランタイムコンテキスト](/docs/server-db/runtime-context)
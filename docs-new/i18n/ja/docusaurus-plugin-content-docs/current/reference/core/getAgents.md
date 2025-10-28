---
title: "Mastra.getAgents()"
description: "Mastra の `Mastra.getAgents()` メソッドに関するドキュメント。設定済みのすべてのエージェントを取得します。"
---

# Mastra.getAgents() \{#mastragetagents\}

`.getAgents()` メソッドは、Mastra インスタンスで設定されているすべてのエージェントを取得するために使用します。

## 使い方の例 \{#usage-example\}

```typescript copy
mastra.getAgents();
```

## パラメータ \{#parameters\}

このメソッドはパラメータを受け取りません。

## 戻り値 \{#returns\}

<PropertiesTable
  content={[
{
name: "agents",
type: "TAgents",
description: "すべての設定済みエージェントのレコード。キーはエージェント名、値はエージェントのインスタンスです。",
},
]}
/>

## 関連項目 \{#related\}

* [エージェントの概要](/docs/agents/overview)
* [ランタイム コンテキスト](/docs/server-db/runtime-context)
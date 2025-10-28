---
title: "Agent.getDescription() "
description: "Mastra エージェントの `Agent.getDescription()` メソッドのドキュメント。エージェントの説明を取得します。"
---

# Agent.getDescription() \{#agentgetdescription\}

`.getDescription()` メソッドは、エージェントに設定された説明を取得します。このメソッドは、エージェントの目的や機能を示すシンプルな文字列を返します。

## 使用例 \{#usage-example\}

```typescript copy
agent.getDescription();
```

## パラメータ \{#parameters\}

このメソッドはパラメータを受け取りません。

## 戻り値 \{#returns\}

<PropertiesTable
  content={[
{
name: "description",
type: "string",
description: "エージェントの説明。説明が設定されていない場合は空の文字列。",
},
]}
/>

## 関連項目 \{#related\}

* [エージェントの概要](/docs/agents/overview)
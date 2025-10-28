---
title: "Agent.getMemory()"
description: "Mastra のエージェントにおける `Agent.getMemory()` メソッドのドキュメント。エージェントに紐づくメモリシステムを取得します。"
---

# Agent.getMemory() \{#agentgetmemory\}

`.getMemory()` メソッドは、エージェントに紐づくメモリシステムを取得します。このメソッドは、複数の会話にまたがって情報を保存・取得するための、エージェントのメモリ機能にアクセスする際に使用します。

## 使い方の例 \{#usage-example\}

```typescript copy
await agent.getMemory();
```

## パラメータ \{#parameters\}

<PropertiesTable
  content={[
{
name: "options",
type: "{ runtimeContext?: RuntimeContext }",
isOptional: true,
defaultValue: "{}",
description: "ランタイムコンテキストを含む任意指定の設定オブジェクト。",
},
]}
/>

## 戻り値 \{#returns\}

<PropertiesTable
  content={[
{
name: "memory",
type: "Promise<MastraMemory | undefined>",
description: "エージェントに構成されたメモリシステムを返す Promise。メモリシステムが構成されていない場合は undefined を返します。",
},
]}
/>

## 応用例 \{#extended-usage-example\}

```typescript copy
await agent.getMemory({
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
description: "依存性注入とコンテキスト情報のためのランタイムコンテキスト。",
},
]}
/>

## 関連項目 \{#related\}

* [エージェントメモリ](/docs/agents/agent-memory)
* [エージェントのランタイムコンテキスト](/docs/server-db/runtime-context)
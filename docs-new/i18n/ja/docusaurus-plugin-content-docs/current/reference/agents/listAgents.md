---
title: "Agent.listAgents() "
description: "Mastra のエージェントにおける `Agent.listAgents()` メソッドのドキュメント。エージェントがアクセスできるサブエージェントを取得します。"
---

# Agent.listAgents() \{#agentlistagents\}

`.listAgents()` メソッドは、エージェントに設定されているサブエージェントを取得し、それらが関数である場合は評価して解決します。これらのサブエージェントにより、エージェントは他のエージェントにアクセスし、複雑な処理を実行できるようになります。

## 使い方の例 \{#usage-example\}

```typescript copy
await agent.listAgents();
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
name: "agents",
type: "Promise<Record<string, Agent>>",
description: "エージェント名をキー、対応する Agent インスタンスを値とするレコードへ解決される Promise。",
},
]}
/>

## さらに進んだ使用例 \{#extended-usage-example\}

```typescript copy
import { RuntimeContext } from '@mastra/core/runtime-context';

await agent.listAgents({
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
description: "依存性の注入やコンテキスト情報に用いるランタイムコンテキスト。",
},
]}
/>

## 関連項目 \{#related\}

* [Agents の概要](/docs/agents/overview)
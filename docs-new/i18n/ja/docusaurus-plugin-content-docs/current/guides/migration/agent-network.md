---
title: "AgentNetwork から .network() への移行"
description: "Mastra で AgentNetwork のプリミティブから .network() へ移行する方法を学びます。"
---

## 概要 \{#overview\}

`v0.20.0` 時点では、以下の変更が適用されています。

### AI SDK v4 から v5 へのアップグレード \{#upgrade-from-ai-sdk-v4-to-v5\}

* すべてのモデルプロバイダー用パッケージをメジャーバージョンに引き上げてください。

> これにより、すべてが v5 のモデルになります。

### メモリが必須です \{#memory-is-required\}

* エージェントネットワークを正しく動作させるには、メモリが必須になりました。

> エージェントのメモリを設定する必要があります。

## 移行パス \{#migration-paths\}

`AgentNetwork` プリミティブを使っていた場合は、`AgentNetwork` を `Agent` に置き換えられます。

変更前:

```typescript
import { AgentNetwork } from '@mastra/core/network';
import { Agent } from '@mastra/core/agent';

const agent = new AgentNetwork({
  name: 'agent-network',
  agents: [agent1, agent2],
  tools: { tool1, tool2 },
  model: openai('gpt-4o'),
  instructions: 'あなたはさまざまなタスクでユーザーを支援できるネットワークエージェントです。',
});

await agent.stream('東京の天気を調べてください。');
```

After:

```typescript
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';

const memory = new Memory();

const agent = new Agent({
  name: 'agent-network',
  agents: { agent1, agent2 },
  tools: { tool1, tool2 },
  model: openai('gpt-4o'),
  instructions: 'あなたはユーザーのさまざまなタスクをサポートできるネットワークエージェントです。',
  memory,
});

await agent.network('東京の天気を教えてください。');
```

`NewAgentNetwork` プリミティブを使用していた場合は、`NewAgentNetwork` を `Agent` に置き換えられます。

Before:

```typescript
import { NewAgentNetwork } from '@mastra/core/network/vnext';
import { Agent } from '@mastra/core/agent';

const agent = new NewAgentNetwork({
  name: 'agent-network',
  agents: { agent1, agent2 },
  workflows: { workflow1 },
  tools: { tool1, tool2 },
  model: openai('gpt-4o'),
  instructions: 'あなたはさまざまなタスクでユーザーを支援できるネットワークエージェントです。',
});

await agent.loop('東京の天気を教えてください。');
```

後で：

```typescript
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';

const memory = new Memory();

const agent = new Agent({
  name: 'agent-network',
  agents: { agent1, agent2 },
  workflows: { workflow1 },
  tools: { tool1, tool2 },
  model: openai('gpt-4o'),
  instructions: 'あなたはユーザーのさまざまなタスクをサポートできるネットワークエージェントです。',
  memory,
});

await agent.network('東京の天気を教えてください。');
```

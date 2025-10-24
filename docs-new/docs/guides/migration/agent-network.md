---
title: 'AgentNetwork to .network()'
description: 'Learn how to migrate from AgentNetwork primitives to .network() in Mastra.'
---

## Overview

As of `v0.20.0`, the following changes apply:

### Upgrade from AI SDK v4 to v5

- Bump all your model provider packages by a major version.

> This will ensure that they are all v5 models now.

### Memory is required

- Memory is now required for the agent network to function properly.

> You must configure memory for the agent.

## Migration paths

If you were using the `AgentNetwork` primitive, you can replace the `AgentNetwork` with `Agent`.

Before:

```typescript
import { AgentNetwork } from '@mastra/core/network';
import { Agent } from '@mastra/core/agent';

const agent = new AgentNetwork({
  name: 'agent-network',
  agents: [agent1, agent2],
  tools: { tool1, tool2 },
  model: openai('gpt-4o'),
  instructions: 'You are a network agent that can help users with a variety of tasks.',
});

await agent.stream('Find me the weather in Tokyo.');
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
  instructions: 'You are a network agent that can help users with a variety of tasks.',
  memory,
});

await agent.network('Find me the weather in Tokyo.');
```

If you were using the `NewAgentNetwork` primitive, you can replace the `NewAgentNetwork` with `Agent`.

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
  instructions: 'You are a network agent that can help users with a variety of tasks.',
});

await agent.loop('Find me the weather in Tokyo.');
```

After:

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
  instructions: 'You are a network agent that can help users with a variety of tasks.',
  memory,
});

await agent.network('Find me the weather in Tokyo.');
```

---
'@mastra/core': minor
---

Added experimental support for using remote A2A agents as Mastra subagents.

**What changed**

- Mastra agents can register remote A2A endpoints through `A2AAgent` and delegate to them like other subagents.
- Remote A2A subagents support `generate`, `resumeGenerate`, `stream`, and `resumeStream` so parent agents can use them in normal subagent flows.
- Agent Cards can be cached and verified with pluggable verification hooks before remote execution begins.
- Browser environments can import shared A2A types and errors from `@mastra/core/a2a/client`.

**Example**

```ts
import { Agent } from '@mastra/core/agent';
import { A2AAgent } from '@mastra/core/a2a';

const agent = new Agent({
  name: 'Support Agent',
  instructions: 'Use the remote billing specialist for billing questions.',
  model: 'openai/gpt-4o-mini',
  agents: {
    billingSpecialist: new A2AAgent({
      url: 'https://billing.example.com/.well-known/agent-card.json',
    }),
  },
});

const result = await agent.generate('Can you check the latest invoice status?');
```

**Why**
This lets Mastra agents compose with remote A2A agents without exposing those integrations as plain tools or depending directly on the client SDK.

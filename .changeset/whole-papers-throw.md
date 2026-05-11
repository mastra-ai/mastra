---
'@mastra/core': minor
---

Added an experimental A2AAgent class for calling remote A2A agents from @mastra/core.

**What changed**

- Remote A2A execution is now available through `A2AAgent.generate`, `resumeGenerate`, `stream`, and `resumeStream`.
- Agent Cards can be cached and verified with pluggable verification hooks before remote execution begins.
- Wrapper integrations can consume typed generate and stream results when adapting remote A2A agents into other Mastra primitives.
- Browser environments can import shared A2A types and errors from `@mastra/core/a2a/client`.

**Example**

```ts
import { A2AAgent } from '@mastra/core/a2a';

const agent = new A2AAgent({
  url: 'https://example.com/.well-known/agent-card.json',
});

const result = await agent.generate('Summarize the latest order.');
console.log(result.text);
```

**Why**
This makes it possible to build higher-level Mastra integrations around remote A2A agents without depending directly on the client SDK.

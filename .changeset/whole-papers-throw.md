---
'@mastra/core': minor
---

Added an experimental A2AAgent class for calling remote A2A agents from @mastra/core.

**What changed**

- Added A2AAgent with generate, resumeGenerate, stream, and resumeStream methods for remote A2A execution.
- Added in-memory Agent Card caching and optional Agent Card verification hooks.
- Added typed generate and stream result objects for wrappers that want to adapt remote A2A agents into other Mastra primitives.
- Added a dedicated `@mastra/core/a2a/client` subpath for browser-safe shared A2A types and errors.

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

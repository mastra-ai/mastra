---
'@mastra/core': minor
---

**Added agent-level response caching**

Cache identical agent calls to skip the LLM and replay a previously cached response. Useful for prompt templates, suggested-prompt buttons, agentic search re-asks, or guardrail LLMs that classify the same input over and over.

```ts
import { Agent } from '@mastra/core/agent';

const agent = new Agent({
  name: 'Search Agent',
  instructions: 'You answer questions concisely.',
  model: 'openai/gpt-5',
  responseCache: { ttl: 600 },
});

// First call: cache miss → LLM call
await agent.generate('What is the capital of France?');

// Second call: cache HIT → no LLM call
await agent.generate('What is the capital of France?');
```

Per-call options override agent-level defaults:

```ts
await agent.stream(prompt, {
  responseCache: {
    key, // override the auto-derived cache key
    ttl, // per-entry TTL in seconds
    scope, // tenant/user scope
    cache, // custom MastraCache implementation
    bust, // bypass any existing entry
  },
});

// Opt out for a single call
await agent.generate(prompt, { responseCache: false });
```

`key` may also be a function that receives the same inputs Mastra would have hashed and returns a custom cache key string (or `Promise<string>`), so you can derive cache keys from any subset of those inputs (e.g. cache only on the model id and the latest user message):

```ts
await agent.stream(prompt, {
  responseCache: {
    key: ({ model, messages }) =>
      `qa:${model.modelId}:${JSON.stringify(messages).slice(-200)}`,
  },
});
```

The auto-derived cache key includes model identity, model settings, system prompt, instructions, tools, structured output schema, and input messages, so any change automatically invalidates the cache. Cache writes happen after the response completes, and failed runs (errors, tripwire activations) are not cached. See [Response caching](https://mastra.ai/en/docs/agents/response-caching) for details.

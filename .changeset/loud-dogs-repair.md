---
'@mastra/core': minor
---

**Added `ResponseCache` input processor**

Cache identical LLM steps to skip the model call and replay a previously cached response. Useful for prompt templates, suggested-prompt buttons, agentic search re-asks, or guardrail LLMs that classify the same input over and over.

Caching is opt-in: register `ResponseCache` explicitly on `inputProcessors`. There is no agent-level option — this keeps the surface small while we collect feedback on the processor API. Per-call overrides flow through `RequestContext`.

```ts
import { Agent } from '@mastra/core/agent';
import { InMemoryServerCache } from '@mastra/core/cache';
import { ResponseCache } from '@mastra/core/processors';

const cache = new InMemoryServerCache();

const agent = new Agent({
  name: 'Search Agent',
  instructions: 'You answer questions concisely.',
  model: 'openai/gpt-5',
  inputProcessors: [new ResponseCache({ cache, ttl: 600 })],
});

// First call: cache miss → LLM call
await agent.generate('What is the capital of France?');

// Second identical call: cache hit → no LLM call
await agent.generate('What is the capital of France?');
```

Per-call overrides via `RequestContext`:

```ts
import { ResponseCache } from '@mastra/core/processors';
import { RequestContext } from '@mastra/core/request-context';

// Force a fresh call but still update the cache.
await agent.stream(prompt, {
  requestContext: ResponseCache.context({ bust: true }),
});

// Or merge into an existing context.
const ctx = new RequestContext();
ResponseCache.applyContext(ctx, { key: 'custom-key' });
await agent.stream(prompt, { requestContext: ctx });
```

Three fields are overridable per call: `key`, `scope`, `bust`. `cache`, `ttl`, and `agentId` stay on the constructor.

A `key` function receives `{ agentId, scope, model, prompt, stepNumber }` and returns a string (or `Promise<string>`):

```ts
await agent.stream(prompt, {
  requestContext: ResponseCache.context({
    key: ({ model, prompt }) =>
      `qa:${model.modelId}:${JSON.stringify(prompt).slice(-200)}`,
  }),
});
```

The cache key is derived from the resolved prompt Mastra is about to send to the model — i.e. _after_ memory loading and earlier input processors have run — so cached entries are tenant-isolated and don't leak context across users with shared prompts but different memory state. Each step in an agentic tool loop is independently cached. By default, the cache scope falls back to `MASTRA_RESOURCE_ID_KEY` from the request context for automatic per-user isolation. Failed runs (errors, tripwire activations) are not cached. See [Response caching](https://mastra.ai/en/docs/agents/response-caching) for details.

Also adds:

- `InMemoryServerCache` (in `@mastra/core/cache`) for local development. `ResponseCache` accepts any `MastraServerCache` directly — use `RedisCache` from `@mastra/redis` for production.
- `MastraServerCache.set()` now accepts an optional `ttlMs` argument so implementations can override the configured default TTL on a per-entry basis. `InMemoryServerCache` and `RedisCache` (in `@mastra/redis`) both honor this.
- New paired processor hooks `processLLMRequest` and `processLLMResponse`. `ProcessLLMRequestResult` may return `{ response }` to short-circuit the LLM call with a cached payload.

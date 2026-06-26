---
'@mastra/inngest': patch
---

Fix `observe()` on Inngest durable agents not replaying events emitted before the observer attached.

Three issues caused the regression and are all fixed:

1. `createInngestAgent` now always wraps its inner `InngestPubSub` with `CachingPubSub`, falling back to an in-process `InMemoryServerCache` when neither the factory nor the registered `Mastra` instance provides a cache. Previously a bare `InngestPubSub` was used when no cache was provided, and `InngestPubSub` has no history replay.
2. The Inngest durable workflow used to construct its own bare `InngestPubSub` inside the function handler, so step publishes never reached the agent's `CachingPubSub`. `InngestWorkflow` now exposes `__setPubsubFactory`, and `createInngestAgent` wires it to return the agent's `CachingPubSub`, so workflow publishes and `observe()` subscriptions share the same cache.
3. `InngestWorkflow.__setPubsubFactory` now propagates the factory to every nested `InngestWorkflow` in the step graph. The durable agentic loop is composed of a parent `inngest:durable-agentic-loop` workflow and a nested `inngest:durable-agentic-execution` workflow (the single-iteration body driven by `dowhile`), and Inngest deploys each as its own function with its own pubsub resolution. Without propagation the inner workflow — which is where `llm-execution` and `tool-call` emit chunk events on `agent.stream.*` — fell back to a bare `InngestPubSub` and bypassed the cache, so `observe()` only ever saw the parent's final `finish` event on replay.

Together these bring Inngest `observe()` to parity with the in-memory `DurableAgent`: late subscribers replay buffered chunk and finish events before attaching to the live stream.

```ts
// First connection kicks off the run
await inngestAgent.stream(messages, { runId: 'run-1' });

// Second connection now replays earlier chunks, then continues live
const { fullStream } = await inngestAgent.observe('run-1');
```

Cross-process `observe()` still requires a shared cache backend (e.g. Redis) passed via `cache` or `mastra.serverCache`; the new in-memory fallback only covers single-process replay.

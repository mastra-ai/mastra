---
'@mastra/inngest': patch
---

Fix `observe()` on Inngest durable agents so late subscribers replay buffered events before the live stream.

Previously, calling `observe()` after a run had started — or reconnecting after a disconnect — only delivered chunks emitted from that moment on. Anything published earlier in the run was lost, including events from nested durable steps. `observe()` now replays the full history of `chunk`, `finish`, and `suspended` events for the requested `runId`, then continues on the live stream, matching the in-memory `DurableAgent` behavior.

```ts
// First connection kicks off the run
await inngestAgent.stream(messages, { runId: 'run-1' });

// Second connection replays earlier events, then continues live
const { fullStream } = await inngestAgent.observe('run-1');
```

When no cache is configured, an in-process cache is used as a fallback so single-process replay works out of the box. Cross-process `observe()` still requires a shared cache backend (e.g. Redis) passed via `cache` or `mastra.serverCache`.

---
'@mastra/core': minor
'@mastra/server': patch
---

Added resumable streams to every `Agent`, not just durable agents. An agent registered on `Mastra` now publishes each run on its stream topic and keeps a replay cache, so a client can reconnect after a disconnect, another reader can follow the run with `agent.observe(runId)`, and any reader can stop it with `observe().abort()` or `agent.abortRunStream(runId)`.

Configure it with the new `streams` option. Streams are on by default for agents registered on `Mastra` and off for standalone agents. Pass `streams: false` to turn them off, or an object to set `pubsub`, `cache`, `shouldCache` and `cleanupTimeoutMs`:

```ts
const agent = new Agent({
  id: 'batch-agent',
  name: 'Batch agent',
  instructions: 'You classify support tickets.',
  model: 'openai/gpt-5-mini',
  streams: false,
});
```

For durable agents, `streams` keys override the matching `durable` keys. `durable: true` with `streams: false` keeps publishing but turns off the replay cache.

Behaviour change: with streams on, closing the HTTP stream no longer aborts a plain agent run on the server. The server detaches the reader so the client can reconnect. Stop a run with `POST /agents/:agentId/runs/:runId/abort`, which now also works for plain agents with resumable streams, or the thread abort route. Set `streams: false` to keep the old disconnect-aborts behaviour.

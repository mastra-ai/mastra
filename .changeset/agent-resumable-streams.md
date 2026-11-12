---
'@mastra/core': minor
'@mastra/server': minor
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

For durable agents, `streams` keys override the matching `durable` keys. `durable: true` with `streams: false` keeps publishing but turns off the replay cache. A durable agent on the default engine now publishes on `mastra.pubsub` once registered, instead of a private in-process bus, so other `Mastra` instances sharing that PubSub and cache can observe its runs. An agent-level `pubsub` still takes precedence.

Observing a run follows it across tool-approval suspensions until it finishes, errors or is aborted, for plain and durable agents alike. Reconnecting is not crash recovery: if the process running a plain agent stops, the run stops.

Behaviour change: with streams on, closing the HTTP stream no longer aborts a plain agent run on the server. The server detaches the reader and the run keeps generating tokens, calling tools and running `onFinish`, so the client can reconnect. Stop a run with `POST /agents/:agentId/runs/:runId/abort`, which now also works for plain agents with resumable streams, or the thread abort route. Set `streams: false` to keep the old disconnect-aborts behaviour.

Behaviour change: observing a run that can't be resumed now fails instead of returning an empty stream. An unknown run, or one whose ownership record expired or was evicted, answers 404, so `client.agents(id).observe({ runId })` rejects with a `MastraClientError` carrying that status. This includes durable agents, which used to resolve to an empty, closed stream.

Servers that share a PubSub and cache (for example Redis) can observe and abort a plain agent run started on any of them. Each run writes an ownership record (agent, run, resource, thread) to the cache before its first event, and the observe and abort routes check the caller against it, including Studio auth mode. Active runs retry a failed initial ownership write after a temporary cache outage. Unknown, expired or evicted runs return 404, and an unreadable cache returns 503. The abort route returns `{ aborted: true }` only when the executing process confirms the stop. Finished runs, runs parked on an approval, and unanswered requests return `{ aborted: false }`.

Behaviour change: a `runId` now belongs to the run that first claimed it. Starting a run with a `runId` that another resource already owns is refused with `AGENT_RUN_ID_ALREADY_CLAIMED` (409 from the server) instead of taking over that run's stream topic and ownership record. A caller with no resource id may not claim a run id that carries one. Runs without a resource id scope nothing to protect, and a run's owner can still reuse its id for a resume or a retry after it finished. A `runId` whose record says a run is still executing is refused even to its owner, because two publishers on one topic would interleave their chunks and abort requests; the one exception is a resume, which has already claimed the suspended run and may still be looking at the previous `running` record while a slow suspend write lands. Reusing a finished id starts on an empty log, so a reader does not replay the previous run's `finish` and stop early, and the previous run's cleanup timer no longer clears the record or history of the run that reused the id.

Run logs and ownership records ask the cache for a 24-hour TTL. `cleanupTimeoutMs: 0` turns off only the post-finish cleanup timer. Cache TTL and eviction still apply, and the in-memory cache's default limit of 1,000 counts cache entries, not runs. Cleanup timers no longer keep an otherwise finished Node.js process alive.

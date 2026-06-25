---
'@mastra/core': patch
---

Fixed duplicate stream events when attaching to an in-progress durable or evented agent run.

When you call `agent.observe(runId, { offset })` (or reconnect to a stream with replay) while `agent.stream()` is still running, the buffered portion of `output.textStream` could be delivered twice before settling into normal single delivery. Late observers now receive each text-delta exactly once.

**Why:** Two issues in the resumable-stream path could double events.

- If you passed a caching pubsub to `new Mastra({ pubsub })` (e.g. `withCaching(...)`), the agent adopted it as its inner transport and then wrapped it again in a second caching layer sharing the same cache. Every event was stored twice, so replay delivered the buffered prefix doubled. The agent now reuses the existing caching pubsub instead of double-wrapping it.

```ts
// This setup no longer double-caches:
const cache = new InMemoryServerCache();
const mastra = new Mastra({ pubsub: withCaching(new EventEmitterPubSub(), cache), cache });
```

- Replay/live deduplication keyed on `event.id`, but the underlying pubsub regenerates `id` on publish, so the cached copy and the live copy of the same event carried different ids and dedup never matched. Deduplication now keys on the event's stable sequential index, which is preserved across both paths.

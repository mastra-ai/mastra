---
'@mastra/core': patch
---

Fixed duplicate stream events when attaching to an in-progress durable or evented agent run.

When you call `agent.observe(runId, { offset })` (or reconnect to a stream with replay) while `agent.stream()` is still running, the first portion of `output.textStream` was delivered twice before settling into normal single delivery. Late observers now receive each text-delta exactly once.

**Why:** Resumable streams deduplicate the overlap between replayed cache history and live events. The cached copy and the live copy of the same event were carrying different ids — the underlying pubsub regenerates `id` when it publishes — so id-based dedup never matched and the buffered prefix came through twice. Deduplication now keys on the event's stable sequential index, which is preserved across both the replay and live paths.

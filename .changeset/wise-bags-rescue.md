---
'@mastra/inngest': patch
---

Fix observability tracing for Inngest workflows

- Use SpanCollector to capture span hierarchy during execution and create real spans in the memoized finalize step
- Fix span timing by using step result `startedAt`/`endedAt` (memoized by Inngest) instead of replay-time timestamps
- Ensures proper parent-child span relationships and accurate durations in traces
- Multi-replica safe: no shared state needed across server instances

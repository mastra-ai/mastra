---
'@mastra/core': patch
'@mastra/inngest': patch
---

Fixed three durable agent bugs:

- Aborting a suspended run with `abortThreadStream()`, `abortRunStream()` or the stream result's `abort()` now removes it from `listSuspendedRuns()`. Previously the run stayed listed as suspended after the abort. This also applies to runs waiting for tool approval: aborting them now releases the run instead of leaving it for a later approve or decline.
- Client tool spans on Inngest agents are now parented to the exported agent run span instead of a span that was never exported.
- Inngest agent streams no longer hang when an event exceeds the Realtime message size limit. Oversized `finish` events are sent without the step history, and oversized `error` events keep the error name and a shortened message so `onError` still fires. Oversized non-terminal events are replaced with a `data-oversized-event` chunk so clients know an event was reduced, and a warning is logged through the Mastra logger.

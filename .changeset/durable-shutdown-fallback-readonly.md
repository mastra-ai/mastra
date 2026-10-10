---
'@mastra/core': patch
'@mastra/inngest': patch
---

Fixed three durable agent bugs:

- `Mastra.shutdown()` now closes the configured pubsub, so Redis connections no longer keep the process alive after shutdown (#26581).
- Inngest durable agents now use fallback models when the primary model fails (#26146).
- `memory.options.readOnly` is now respected when a durable run finishes from a restored snapshot, so Inngest read-only turns are no longer saved (#26147).

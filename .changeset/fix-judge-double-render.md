---
'@mastra/core': patch
---

Fixed goal judge TUI rendering every tool call twice. The root cause was `tryStreamWithJsonFallback` invoking the `onStream` callback on both the initial stream and the structured-output-parsing fallback retry, so the consumer received two complete sets of tool-call activities.

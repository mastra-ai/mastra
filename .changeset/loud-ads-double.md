---
'@mastra/core': patch
---

Tool `toModelOutput` invocations now emit a `MAPPING` tracing span with the raw tool result as input and the transformed value as output. Previously traces only captured the raw `execute()` result, so there was no way to tell whether a tool's `toModelOutput` ran as a no-op, transformed the payload, or was never invoked at all (https://github.com/mastra-ai/mastra/issues/15486). The new span is only emitted when a tool defines `toModelOutput` and produced a result, so there are no empty spans for tools without the hook.

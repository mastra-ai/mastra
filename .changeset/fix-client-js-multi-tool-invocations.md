---
'@mastra/client-js': patch
---

fix(client-js): collect all tool invocations from streamed tool-calls step

Previously, `processStreamResponse` and `processStreamResponseLegacy` used
`reverse().find()` to pick only the last `tool-invocation` part from a
finished step. When the assistant emitted multiple client tool invocations
in one step, only one was executed — the rest were silently dropped.

This change:
- Collects **all** pending tool invocations (state === 'call') from the
  message parts instead of just the last one
- Deduplicates by `toolCallId` to prevent reprocessing
- Executes all matching client tools, patches all results into a single
  cloned message, then makes **one** recursive continuation call
- Clears the `toolCalls` array after processing to prevent stale
  accumulation across continuations

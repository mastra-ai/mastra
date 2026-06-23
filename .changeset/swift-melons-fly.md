---
'@mastra/client-js': patch
'mastracode': patch
---

Fix two web-app chat issues:

- **Switching threads did nothing.** The thread-switch call ran outside the
  error boundary, so any transient failure rejected the handler silently and
  the view never changed. Switching now updates the transcript optimistically,
  loads the target thread's history, and surfaces an error notice if it fails.
- **Tool calls weren't rendered from history.** Selecting a thread only showed
  plain assistant text and dropped tool executions. The transcript now
  reconstructs tool-call cards (name, args, result, error state) interleaved
  with text — matching how the terminal renders existing messages. To support
  this, `HarnessMessageContent` now exposes the `id` that correlates a
  `tool_call` part with its `tool_result`.

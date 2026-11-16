---
'@mastra/core': minor
---

Added a `persist` option to a processor's `abort()`, so a guardrail or output processor that stops a run can choose what memory keeps for the blocked turn.

By default nothing changes: a tripwire still rolls back the response messages the run already saved, so a blocked reply never reaches the thread or the next turn's model input. Calling `abort(reason, { persist: 'partial' })` keeps them instead, leaving the user message, completed steps with their tool results, and the text streamed before the abort in the thread. Runs stopped by the caller's `abortSignal`, by a provider error, or by the total timeout already keep their messages and are unaffected.

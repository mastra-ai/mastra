---
'@mastra/inngest': patch
---

Fixed three issues in createInngestAgent `resume()`:

- Resuming a `suspend()`-based tool call now targets the nested tool-call step. Previously the resume event only named the outer workflow step, so the resume restarted the iteration without delivering the tool result and the model asked for approval again.
- Added a `requestContext` option to `resume()`. Caller-supplied entries are merged over the context persisted in the workflow snapshot, so context derived from the resuming request (for example auth-derived user ids) is no longer silently dropped.

```typescript
await durableAgent.resume(
  runId,
  { approved: true },
  {
    requestContext, // merged over the snapshot's persisted context
  },
);
```

- `resume()` now awaits the resume event dispatch. If sending the event fails (storage or network error), the call rejects and releases the stream and run-registry entry instead of leaving the caller's stream hanging with no error.

Fixes #20670

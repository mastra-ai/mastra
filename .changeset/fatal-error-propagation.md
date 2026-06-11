---
'@mastra/core': minor
---

Add `FatalError` and `abort.fatal()` for propagating structured errors from processors and workflow steps to the caller without wrapping.

Previously, throwing a custom error from an input/output processor wrapped it in a `MastraError` (original on `.cause`), and calling `abort(reason)` swallowed any typed context. Callers had no way to receive their original error class with `instanceof` checks and custom properties intact.

Now, you can call `abort.fatal(err)` inside a processor, or `throw new FatalError(err)` inside a workflow step, and the original error is propagated unwrapped to the caller.

```ts
class QuotaExceededError extends Error {
  code = 'QUOTA_EXCEEDED';
  retryAfterSeconds = 60;
}

// In an input/output processor:
processInput({ abort }) {
  if (overQuota) abort.fatal(new QuotaExceededError('quota exceeded'));
}

// In a workflow step:
execute() {
  if (overQuota) throw new FatalError(new QuotaExceededError('quota exceeded'));
}

// Caller:
try {
  await agent.generate(...);
} catch (err) {
  if (err instanceof QuotaExceededError) {
    console.log(err.code, err.retryAfterSeconds); // typed access works
  }
}
```

Backward compatible: existing `abort(reason)` and `throw new Error(...)` behavior is unchanged. Only opt-in `abort.fatal()` / `FatalError` get the new propagation. Closes #17808.

---
'@mastra/core': patch
---

Forward the parent `abortSignal` to delegated subagents so that aborting a supervisor's `stream()` or `generate()` call cancels in-flight subagents instead of letting them run to completion.

Previously, calling `AbortController.abort()` on a supervisor only stopped the supervisor itself: each delegated subagent kept looping and calling its own tools and the LLM for several seconds after the abort, because the delegation tool dropped the parent's `abortSignal`. The signal is now propagated to every delegation path (`stream`, `generate`, `resumeStream`, `resumeGenerate`, and the legacy variants).

```typescript
const controller = new AbortController();

const stream = await supervisor.stream('Research AI trends', {
  abortSignal: controller.signal,
});

// Now also cancels any in-flight subagents, not just the supervisor
controller.abort();
```

Fixes #14820.

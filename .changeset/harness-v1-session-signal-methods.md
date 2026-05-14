---
'@mastra/core': minor
---

Added Harness v1 `Session.signal()` and `Session.injectSystemReminder()`.

- `session.signal(...)` is the optimistic user-message primitive. It returns synchronously with `{ id, runId, willInterleave, accepted, signal, result }` so callers can render an optimistic transcript row and correlate it to the eventual run.
- `session.injectSystemReminder(content, opts?)` dispatches a system-reminder signal without opening a new turn boundary and returns `{ id, runId, willInterleave, accepted, signal }`.
- Both methods reuse the signal-routed dispatch path used by `session.message(...)`.
- Per-turn overrides such as `mode` and `additionalTools` on an active-delivery signal reject at admission with `HarnessOverrideConflictError`.

```ts
const accepted = await session.signal('Use the latest workspace files.');

await session.injectSystemReminder('Check the migration checklist before continuing.', {
  runId: accepted.runId,
});
```

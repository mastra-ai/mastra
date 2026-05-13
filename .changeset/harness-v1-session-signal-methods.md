---
'@mastra/core': minor
---

Harness v1: add `Session.signal()` and `Session.injectSystemReminder()`. `signal()` is the optimistic user-message primitive — returns synchronously with `{ id, runId, willInterleave, accepted, signal, result }` so callers can render an optimistic transcript row before the turn completes and correlate it to the eventual run. `injectSystemReminder(content, opts?)` dispatches a system-reminder signal without a new turn boundary, returning `{ id, runId, willInterleave, accepted, signal }`. Both reuse the existing signal-routed dispatch path used by `message()`. Per-turn overrides (`mode`, `additionalTools`) on an active-delivery signal reject at admission with `HarnessOverrideConflictError`.

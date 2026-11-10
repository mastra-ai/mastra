---
'@mastra/core': patch
---

Fixed `Agent.observe()` replays showing a later state of a run than the one the caller saw live. After a tool approval and resume, a replayed `step-finish` could list steps that only happened after it was emitted. Each published stream event is now a copy taken when it is published, so replays from the in-memory cache and Redis match the live stream.

**Behavior change for same-process observers:** the copy uses the same encoding as cross-process pubsub, not a lossless clone. Events received through `Agent.observe()` or the stream pubsub in the same process now behave like events received from another process:

- `Date`, `Error`, `Map`, `Set`, `BigInt`, `undefined` values, and registered classes (step results, generated files) are preserved.
- Functions and symbols are dropped, `NaN`/`Infinity` and circular references become `null`, and arbitrary `Uint8Array`s and other unregistered class instances become plain data.
- If an event cannot be encoded (for example, a `toJSON()` that throws), a warning is logged and that event is published as-is, without the snapshot guarantee.

The stream returned directly to the caller of `agent.stream()` is unchanged.

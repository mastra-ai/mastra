---
'@mastra/core': patch
---

Made the evented workflow engine safe for agentic loops that carry non-serializable runtime state.

- Cross-process workflow payloads now round-trip cleanly through the Unix socket pubsub broker. `Date`, `Error`, `Map`, `Set`, `RegExp`, `URL`, `BigInt`, `undefined` values, and registered class instances (e.g. `GeneratedFile`) survive the JSON encode/decode at the wire boundary instead of being dropped or flattened to plain objects.
- Introduced a per-run `RunScope` on `Mastra`, keyed by `runId` and refcounted alongside `__registerInternalWorkflow`. It holds non-serializable runtime state (`MessageList`, processor states, converted tools, loop options, `SaveQueueManager`, `BackgroundTaskManager`, `MastraMemory`, `StreamTransportRef`, dynamic `ToolSet`, `Workspace`, drain-signal closures, …) that must never cross the wire. The scope is never persisted, never published over pubsub, and dies with the run.
- Migrated the `prepare-stream`, `agentic-execution`, and `agentic-loop` step factories to read and write this state through typed `RunScopeKey<T>` keys instead of the legacy `_internal` closure bag. The corresponding `StreamInternal` fields are marked `@deprecated` for external callers (the type still accepted by `loop()` for back-compat; `loop()` hydrates the scope from it once at the single bootstrap point).
- Added a serialization-invariants test that asserts none of the agentic step output schemas advertise live handle keys and that encoded sample outputs never produce class or function codec envelopes.

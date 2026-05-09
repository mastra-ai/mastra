---
'@mastra/core': minor
---

Wired Harness v1 into Mastra and shipped the first runnable slice of `Session.message()`.

- `Mastra` config gains `harnesses?: Record<string, Harness>`; harnesses bind to the parent Mastra during construction so their modes resolve through `mastra.getAgent(...)`. Look them up with `mastra.getHarness('name')`.
- `HarnessConfig` rewired to accept either an existing `mastra` instance or an inline `{ agents, storage }` pair (Harness builds an internal Mastra in the latter case).
- `Session.message()` implemented for all three return shapes — default `AgentResult`, `{ stream: true }` live `MastraModelOutput`, and `{ output: schema, sync: true }` structured/fail-fast object.
- Per-turn overrides supported on `message()`: `mode`, `additionalTools`, `abortSignal`. Per-mode `tools`/`additionalTools` are merged into the agent's toolset surface for the call.
- Added `getCurrentMode`, `getCurrentModel`, `setMode`, `setModel`, and `getDisplayState` to `Session`. Setters CAS-write through the harness storage lease.

Internal-only API; no breaking changes to existing surfaces.

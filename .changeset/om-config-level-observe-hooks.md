---
'@mastra/memory': minor
---

Config-level `hooks` for Observational Memory. `ObserveHooks` can now be set on the OM config — including through `Memory`'s `observationalMemory` options — and fire for every observation/reflection cycle: manual `observe()` calls, turn-engine sync observation, and fire-and-forget async buffering. Config-level hook callbacks receive `threadId` / `resourceId` / `trigger` call context alongside the existing `usage` and `providerMetadata`, so apps can account for OM model economics without wrapping the observer/reflector models in middleware. Config-level hook errors are caught and logged, never failing the cycle; per-call `observe()` hooks keep their existing payloads and semantics.

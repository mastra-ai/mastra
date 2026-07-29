---
'@mastra/core': patch
---

Fixed out-of-memory crashes during long streamed responses by replacing the per-delta deep clone of the accumulated message in the agent-controller run engine with a shallow snapshot that shares immutable payloads. Previously every text/reasoning/tool delta cloned the entire message content — including embedded tool results — making allocation quadratic in message size and exhausting the V8 heap when subscribers retained snapshots (e.g. plugin tools such as adversarial review).

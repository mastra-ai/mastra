---
'@mastra/core': minor
---

Wired the Harness v1 resolver and session lifecycle on top of the new `HarnessStorage` domain. `new Harness(config)` validates modes/agents at construction; `harness.session(...)` finds-or-creates sessions per HARNESS_V1_SPEC.md §5.3, acquires the durable write lease, and returns a real `Session` instance. Lifecycle methods (`session.close()`, `harness.closeSession`, `harness.listSessions`, `harness.loadSession`, `harness.shutdown`) are functional, including cascade through `parentSessionId` and lease release on shutdown. The rest of the v1 surface (message, queue, attachments, threads, intervals) still throws — those slices land in the next milestone. This is internal infrastructure — no public-facing API yet.

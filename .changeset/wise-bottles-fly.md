---
'@mastra/core': patch
---

Internal: extracted the Harness constructor's session wiring (thread-settings store, mode/model/om/permissions/subagents resolvers, thread data store, and initial mode/model seeding) into a private `#wireSession(session, defaultMode)` helper. No behavior or public API change — this is groundwork for wiring additional sessions to a single Harness.

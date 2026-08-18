---
'@mastra/core': patch
---

Stop evicting long-running agent runs at the suspended-run TTL. `MASTRA_SUSPENDED_RUN_TTL_MS` now bounds how long a run-scoped internal workflow may sit **idle**, not how long a run may take. Previously the lazy sweep measured wall-clock age from registration, so any run that legitimately executed past the TTL (30 minutes by default) had its workflow registration and run scope dropped mid-flight and went silent. Abandoned or suspended-and-never-resumed runs are still released on the same bound, so the memory protection is unchanged. Operators who raised the knob to work around this can return it to the default.

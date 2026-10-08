---
'@mastra/e2b': minor
---

Add `E2BFactorySandbox`, the factory host contract for E2B sandboxes, with `cpuCount`, `memoryMb` and `idleTimeoutMinutes` settings (2 CPUs, 1024 MB and 5 minutes when unset) and a `builds` capability that starts template builds in the background, reads build status with logs, and lists a template's builds.

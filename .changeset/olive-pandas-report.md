---
---

Correct the stale `maxSteps` docblock on the supervisor integration tests. `maxSteps`
is a hard ceiling on the plain agent loop, not a limit a failing `isTaskComplete`
scorer can push past. Comment-only change; no package release.

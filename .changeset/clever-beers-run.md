---
'@mastra/azure': patch
---

Fixed the Azurite integration test failing in CI with address already in use on port 10000. Docker now exposes the container on a dynamically assigned host port instead of a fixed mapping, and the test script discovers the actual port at runtime via docker compose port. This eliminates conflicts with other services or lingering containers on the runner.

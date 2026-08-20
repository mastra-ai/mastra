---
'@mastra/deployer': minor
---

Added a nullable `workers.json` manifest to deployment builds. It contains the statically extractable `backgroundTasks` configuration when enabled and `null` otherwise, allowing Mastra Cloud to create, update, or stop the dedicated worker service from the deploy artifact.

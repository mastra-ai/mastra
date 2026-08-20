---
'@mastra/deployer': minor
---

Added a `workers.json` manifest to deployment builds when `backgroundTasks` is statically enabled. Mastra Cloud uses this manifest to create a dedicated worker service from the same deploy artifact and display the deployed worker configuration.

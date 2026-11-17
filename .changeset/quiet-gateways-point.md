---
'mastra': patch
---

Creating a project with the Mastra Gateway now writes `MASTRA_GATEWAY_URL` to `.env` when the CLI points at a non-production platform, such as staging, so the new project calls the gateway its key belongs to instead of failing with 401. Production projects get no extra line. When no key can be created, the CLI now sends you to the Mastra platform dashboard to create one instead of `gateway.mastra.ai`.

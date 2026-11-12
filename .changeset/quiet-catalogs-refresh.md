---
'@mastra/core': patch
---

Improved how fast `AgentController.listAvailableModels()` answers. Once the models.dev and Netlify catalogs have downloaded, calls reuse them instead of downloading both again every 10 seconds. The first call still waits for both downloads.

- Model lists stay complete when a catalog download fails. The last downloaded models are kept. A catalog that has never downloaded is retried on a later call, which waits for it.
- Catalogs older than 5 minutes refresh in the background, so calls never wait for them.
- A slow or unreachable catalog no longer delays the other one.
- Saved or removed API keys and custom providers still show up within 10 seconds, or on the next call after `invalidateAvailableModelsCache()`. That call rechecks configured gateways and API keys and answers from the saved catalogs while they download again in the background.
- Use counts are up to date on every call.

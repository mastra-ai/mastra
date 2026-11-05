---
'@mastra/core': patch
---

Improved how fast `AgentController.listAvailableModels()` answers. After the first call, model lists come back right away instead of downloading the models.dev and Netlify catalogs again every 10 seconds.

- Model lists stay complete when a catalog download fails. The last downloaded models are kept.
- Catalogs older than 5 minutes refresh in the background, so calls never wait for them.
- A slow or unreachable catalog no longer delays the other one.
- Saved or removed API keys and custom providers still show up within 10 seconds, or on the next call after `invalidateAvailableModelsCache()`. That call no longer waits for the catalogs to download again.
- Use counts are up to date on every call.

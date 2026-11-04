---
'@mastra/core': patch
---

Faster model lists from `AgentController.listAvailableModels()`. The models.dev and Netlify catalogs (models.dev's is about 6 MB) are now refreshed in the background every 5 minutes, instead of being downloaded again on the first call after 10 seconds. Calls answer from the last downloaded catalog and keep it if a download fails. Calls made at the same time share one download.

Credential and custom provider changes still show up within 10 seconds, or on the next call after `invalidateAvailableModelsCache()`, which no longer downloads the catalogs again. Use counts are now current on every call.

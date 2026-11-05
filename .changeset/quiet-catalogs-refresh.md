---
'@mastra/core': patch
---

Faster model lists from `AgentController.listAvailableModels()`. The models.dev and Netlify catalogs (models.dev's is about 6 MB) are no longer downloaded again on the first call after 10 seconds. A call waits for a catalog only until it has downloaded once. After that, calls answer from the last downloaded catalog and keep it if a download fails. Once it's 5 minutes old, the next call refreshes it in the background without waiting. Calls made at the same time share one download.

Credential and custom provider changes still show up within 10 seconds, or on the next call after `invalidateAvailableModelsCache()`, which no longer downloads the catalogs again. Use counts are now current on every call.

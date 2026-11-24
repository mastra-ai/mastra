---
'@mastra/factory': minor
---

Added self-hosted GitLab to Platform-connected Factories. Connect an instance from Settings or onboarding with **Connect self-hosted** (or **Add self-hosted** once GitLab is connected) by entering its hostname and a personal or group access token. Its projects then show up for intake and repositories next to gitlab.com ones, and Factory clones and calls the API on that instance. An expired self-hosted connection reconnects with a new token on the same instance; its hostname cannot be changed.

Known limitation: if a self-hosted connection is moved to another instance outside Factory, and moved back while Factory is fetching a repository credential, a clone can use the other instance's token against the original instance. Closing this depends on Mastra Platform pinning the hostname on reconnect (mastra-ai/platform#5637).

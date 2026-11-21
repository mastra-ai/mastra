---
'@mastra/factory': minor
---

Added self-hosted GitLab to Platform-connected Factories. Connect an instance from Settings or onboarding with **Connect self-hosted** (or **Add self-hosted** once GitLab is connected) by entering its hostname and a personal or group access token. Its projects then show up for intake and repositories next to gitlab.com ones, and Factory clones and calls the API on that instance. An expired self-hosted connection reconnects through the same hostname and token form.

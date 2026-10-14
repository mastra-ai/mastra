---
'@mastra/factory': patch
---

Fixed the personal default model picker offering models only an organization credential can run. Personal defaults only apply in Factories that use personal credentials, so `GET /web/config/models?scope=user` now lists just the models your own connected accounts can run, and the personal settings page warns when your saved default isn't one of them.

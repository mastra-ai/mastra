---
'@mastra/react': patch
'@mastra/core': patch
---

Fixed persisted-signal thread broadcasts emitting a `start` chunk without `from` and `payload`. Threads created only from persisted signals (`sendSignal(..., { ifIdle: { behavior: 'persist' } })`) now stream a `start` chunk shaped like every other agent run, so chunk consumers such as Mastra Studio no longer crash when replaying them. Fixes https://github.com/mastra-ai/mastra/issues/23244

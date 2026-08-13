---
'@mastra/langfuse': patch
---

Fixed Langfuse scores being ingested into the wrong environment. Scores submitted through the exporter's score pipeline (including `observability.addScore` and the deprecated `addScoreToTrace`) now carry the exporter's configured `environment`, matching the traces they belong to. Previously, with `new LangfuseExporter({ environment: 'production' })`, spans landed in `production` but their scores landed in the `default` environment, so environment-scoped views like the session list's Scores column and score analytics showed nothing. Fixes [#21315](https://github.com/mastra-ai/mastra/issues/21315)

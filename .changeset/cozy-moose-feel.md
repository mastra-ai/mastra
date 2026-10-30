---
'@mastra/core': patch
---

When observational memory stops a run because its model call failed, the run's `error` event now keeps the provider status and codes as the error's `cause`. An agent controller consumer can classify that failure, for example as a rate limit, the same way it classifies a failed main model call. Refs [#28696](https://github.com/mastra-ai/mastra/issues/28696).

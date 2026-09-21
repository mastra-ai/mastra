---
'@mastra/core': patch
---

Fixed model settings returned by an input processor being ignored when the agent also configured them. Fixes https://github.com/mastra-ai/mastra/issues/22395

Values returned from `processInputStep` or `prepareStep` now take effect for the model call, including `maxRetries`. Previously any setting the model list also specified won the conflict, so a processor could not change it. This affected single-model agents as well as fallback chains.

A processor that returns only some settings (for example just `{ temperature }`) keeps the configured retry and timeout limits. Inference telemetry now reports the settings the model actually received.

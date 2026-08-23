---
'@mastra/core': patch
---

Fixed agent model calls to honor `modelSettings.maxRetries` when no retry count is explicitly configured on the agent or fallback model. Agents with no retry configuration continue to make a single attempt by default, while explicit agent or fallback settings—including `maxRetries: 0`—continue to override call-time settings.

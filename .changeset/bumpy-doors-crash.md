---
'@mastra/core': patch
'@mastra/memory': patch
---

Fixed failed tool calls being treated as successful results in agent history, live harness streams, and observational memory token counting. Tool errors are now preserved as error outputs when reloading memory, and continued finish chunks no longer stop the harness before the agent can respond to a failed tool call. Fixes #15569.

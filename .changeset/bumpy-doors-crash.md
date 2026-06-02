---
'@mastra/core': patch
'@mastra/memory': patch
---

Fixed failed tool calls being treated as successful results in agent history, live harness streams, and observational memory. Tool errors are now preserved as error outputs end-to-end: they survive memory reload, the observational-memory observer and recall transcripts include the error so the agent keeps the failure context, the token limiter and tool-call filter account for failed results, and tool-accuracy evals record a failed tool as an unsuccessful step. Continued finish chunks no longer stop the harness before the agent can respond to a failed tool call. Fixes #15569.

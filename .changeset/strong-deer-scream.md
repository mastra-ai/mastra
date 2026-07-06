---
'@mastra/server': patch
---

Fixed AgentController route handlers dropping the request context set by server middleware. Identity values set on the request context in `server.middleware` (for example a tenant id) now reach dynamic instructions and tools when an agent is driven through the AgentController API, matching the behavior of the plain agent routes. This applies to the send-message, steer, follow-up, tool-approval, and tool-suspension routes. Fixes [#18916](https://github.com/mastra-ai/mastra/issues/18916).

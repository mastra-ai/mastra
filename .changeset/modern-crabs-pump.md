---
'@mastra/client-js': patch
---

Updated generated route types so `memory.resource` is optional in agent generate and stream request bodies. The server can derive the resource ID from the authenticated user via `mapUserToResourceId`, so clients no longer need to provide it. Fixes [#19518](https://github.com/mastra-ai/mastra/issues/19518).

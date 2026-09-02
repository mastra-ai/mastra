---
'@mastra/core': patch
---

Fixed durable agent run recovery losing the fallback model list. After a process restart, DurableAgent.recover() now restores the live fallback models with the ids the run was prepared with, so recovered runs keep using custom or dynamically resolved fallback model instances instead of failing or falling back to models rebuilt from serialized config. Fixes [#22594](https://github.com/mastra-ai/mastra/issues/22594).

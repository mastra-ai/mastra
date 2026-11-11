---
'@mastra/editor': patch
---

Preserve the existing stored-agent registration when hydrating a different draft, status, or version of an agent. Version-specific lookups return the requested agent without replacing the registered instance.

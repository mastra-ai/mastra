---
'@mastra/core': patch
---

Fixed a memory leak where every discarded standalone agent (an `Agent` used directly without being registered on a `Mastra` instance) stayed reachable for the lifetime of the process. The internal Mastra instance created for standalone execution no longer registers a module-level scorer hook it can never use, so standalone agents are garbage-collected once discarded. Applications that create one agent per request no longer see linear heap growth.

Fixes [#19404](https://github.com/mastra-ai/mastra/issues/19404).

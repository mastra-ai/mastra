---
'@mastra/server': patch
---

Fixed agent-builder routes in processes that run more than one Mastra instance. Each instance now gets its own agent-builder workflows. A run started for one instance no longer writes to another instance's storage, and an instance that was shut down can be garbage collected after serving an agent-builder request. Fixes [#29190](https://github.com/mastra-ai/mastra/issues/29190).

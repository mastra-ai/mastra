---
'@mastra/core': patch
---

Fixed semantic recall not injecting recalled messages into the prompt when chatting through Studio. User messages sent through the agent signal pipeline (used by the Studio playground) were stored as signal rows and skipped when extracting the recall query, so recalled context never reached the model even though retrieval worked and the same request succeeded via the HTTP API. Fixes [#17797](https://github.com/mastra-ai/mastra/issues/17797)

---
'@mastra/code-sdk': patch
---

Reduced Mastra Code memory use when observational memory is on. Observation embeddings now run in a separate worker process, so the embedding model no longer stays in the agent process. The worker loads the model once and reuses it. It exits after five minutes without embedding work, and the next embedding starts a new one.

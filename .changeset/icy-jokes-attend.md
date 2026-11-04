---
'@mastra/code-sdk': patch
---

Reduced Mastra Code memory use when observational memory is on. Observation embeddings now run in a short-lived child process, so the agent no longer keeps about 230 MB of embedding model memory for the rest of the session. Set `MASTRACODE_EMBED_IN_PROCESS=1` to embed inside the agent process as before.

---
'@mastra/code-sdk': patch
'mastracode': patch
---

Observational memory and thread-title calls on Anthropic no longer write their whole prompt to the 1-hour prompt cache. Each call sends different conversation content, so that cache entry was never read. They now cache only their shared instructions for 5 minutes, which the next observer call reads. The main agent still uses the 1-hour cache.

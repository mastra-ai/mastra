---
'@mastra/memory': patch
'@mastra/server': patch
---

Reduced memory use on Cloudflare Workers and other V8 runtimes that bundle @mastra/memory or @mastra/server. Their published JavaScript now only uses Latin-1 characters in code. V8 stores a bundle's source at one byte per character instead of two only when the whole bundle is Latin-1, so the saving applies when your own code and other dependencies are Latin-1 as well. In a minimal Worker with an agent, memory and the Mastra server, heap after six requests dropped from 56.8 MiB to 43.8 MiB.

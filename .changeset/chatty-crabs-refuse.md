---
'@mastra/memory': patch
'@mastra/server': patch
---

Reduced memory use on Cloudflare Workers and other V8 runtimes that bundle @mastra/memory or @mastra/server. Their published JavaScript now only uses Latin-1 characters in code, so V8 can store the whole bundle source with one byte per character instead of two. In a minimal Worker with an agent, memory and the Mastra server, heap after six requests dropped from 56.8 MiB to 43.8 MiB.

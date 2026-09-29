---
'@mastra/core': patch
---

Fixed `<PROVIDER>_BASE_URL` being ignored for providers such as Google, xAI, Perplexity, Cerebras, DeepInfra, Together AI, and Vercel. Setting `GOOGLE_BASE_URL` (or the equivalent for other providers) now routes requests and API keys through your proxy or gateway instead of the public provider host.

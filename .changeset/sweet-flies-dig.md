---
'@mastra/code-sdk': patch
'mastracode': patch
---

Mastra Code now caches prompts for 1 hour instead of 5 minutes on direct Anthropic connections (API key or Claude subscription), and waits for 1 hour of idle time before compacting memory on those models. Claude through other providers, such as Amazon Bedrock, keeps the 5-minute behavior. Coming back to a conversation after a break of up to an hour reuses the cached prompt instead of resending it in full.

**Cost tradeoff:** writing a 1-hour cache entry costs 2× the base input price, compared with 1.25× for a 5-minute entry. Cache reads cost the same. Sessions that pause for between 5 minutes and an hour can come out cheaper because they read the cache instead of rewriting it. Sessions that never pause that long pay more for every cache write.

The 1-hour cache also applies to Anthropic models used for memory observation, reflection, and thread titles, since they go through the same model setup.

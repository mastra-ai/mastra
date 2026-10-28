---
'@mastra/code-sdk': patch
---

**Kept OpenAI prompt caching working across the steps of a run.** OpenAI requests now send the thread id as `prompt_cache_key`, on both the ChatGPT subscription (Codex) and API-key routes. Codex requests also send it as `session-id` and `thread-id` headers. Before, requests carried no cache key, and all of them start with the same system prompt, so consecutive steps of a run often missed the cache and about half their input was billed uncached.

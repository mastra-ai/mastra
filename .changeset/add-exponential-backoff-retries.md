---
"@mastra/core": patch
---

Add exponential backoff to model retry logic to prevent cascading failures

When AI model calls fail, the system now implements exponential backoff (1s, 2s, 4s, 8s, max 10s) before retrying instead of immediately hammering the API. This prevents:
- Rate limit violations from getting worse
- Cascading failures across all fallback models  
- Wasted API quota by burning through retries instantly
- Production outages when all models fail due to rate limits

The backoff gives APIs time to recover from transient failures and rate limiting.


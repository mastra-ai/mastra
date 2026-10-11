---
'@mastra/factory': patch
---

Improved GitHub API latency in Factory. GitHub calls for an installation now reuse its access token until it nears expiry, instead of requesting a new token before every call. This roughly halves the time of each GitHub call and avoids hitting GitHub's token rate limits.

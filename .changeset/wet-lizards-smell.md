---
'@mastra/factory': patch
---

Improved GitHub API latency in Factory. GitHub calls for an installation now reuse its access token until it nears expiry, instead of requesting a new token before every call. After the first call, each GitHub call takes about half as long, and Factory requests far fewer tokens, reducing the risk of hitting GitHub's token rate limits.

---
"@mastra/playground-ui": patch
---

Add fetchWithRefresh() utility that auto-retries requests on 401 after refreshing the session, and update useCurrentUser hook to use it

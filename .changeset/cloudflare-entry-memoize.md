---
'@mastra/deployer-cloudflare': patch
---

Memoize Mastra and Hono server construction in the generated Cloudflare Worker entry. Construction still happens inside a fetch context (env bindings are unavailable at global scope) but now runs once per isolate instead of on every request, so per-instance caches like storage init guards and editor caches work on warm requests. A failed first construction is not cached and the next request retries.

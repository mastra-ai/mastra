---
'@mastra/hono': patch
'@mastra/server': patch
---

Fixed agent replies from channels being silently dropped on Cloudflare Workers.

The bot would receive a message and the webhook returned `200 OK`, but no reply was posted and nothing was logged. Channel replies run after the webhook responds, and on Cloudflare Workers that remaining work was being dropped once the response was sent. It is now kept running to completion, so the reply is delivered. (#19285)

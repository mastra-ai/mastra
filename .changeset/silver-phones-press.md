---
'@mastra/hono': patch
---

The Hono adapter now awaits `getToolset` calls in browser-stream routes, supporting deployers that resolve agents asynchronously (such as stored agents looked up via the editor).

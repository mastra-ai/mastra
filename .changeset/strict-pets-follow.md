---
'@mastra/client-js': patch
'@mastra/server': patch
'@mastra/hono': patch
'@mastra/express': patch
'@mastra/koa': patch
---

Improved agent thread subscription resilience by keeping server streams active during idle periods and allowing the JavaScript client to reconnect when subscription streams close or resubscribe requests fail.

Enable automatic reconnection with `subscription.processDataStream({ onChunk: chunk => console.log(chunk), reconnect: true })`.

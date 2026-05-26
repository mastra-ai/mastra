---
'@mastra/client-js': patch
'@mastra/server': patch
'@mastra/hono': patch
'@mastra/express': patch
'@mastra/koa': patch
---

Improved agent thread subscription resilience by keeping server streams active during idle periods and allowing the JavaScript client to reconnect when subscription streams close or resubscribe requests fail.

Enable automatic reconnection with `subscription.processDataStream({ onChunk: chunk => console.log(chunk), reconnect: true })`.

Errors thrown by a caller-supplied `onChunk` callback are now wrapped in a `MastraError` (`id: 'CLIENT_JS_ONCHUNK_CALLBACK_THREW'`) and rethrown without triggering reconnect, so a user-side bug in `onChunk` no longer causes an infinite resubscribe loop.

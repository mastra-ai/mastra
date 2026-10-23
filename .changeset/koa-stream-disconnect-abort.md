---
'@mastra/koa': patch
---

Fixed agent streams continuing after the client disconnects on Koa. Closing the connection mid-stream now aborts the agent run, so it stops calling the model and running tools, the same as on the other server adapters.

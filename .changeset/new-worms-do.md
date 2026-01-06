---
'@mastra/express': patch
---

The abort signal was being triggered when the request body was parsed by `express.json()` middleware, causing `agent.generate()` to return empty responses with 0 tokens. Changed from `req.on('close')` to `res.on('close')` to properly detect client disconnection instead of body consumption.

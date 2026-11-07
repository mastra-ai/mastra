---
'@mastra/server-adapters-test-suite': patch
---

Added `createStreamDisconnectTestSuite`, which checks over real HTTP that an adapter stops reading a route's stream when the client disconnects and pauses reading while the client is not reading.

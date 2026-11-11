---
'@mastra/core': patch
'@mastra/server': patch
---

Answering a tool question (such as approving a plan) now works after the server that parked the run has restarted. The run is picked up from storage instead of the reply being rejected as having nothing waiting on it.

---
'@mastra/server': patch
---

Fixed agent session run failures surfacing as "Run failed with an unknown error" in clients. Error events now flatten Error-like payloads so the real failure message reaches the client, and run errors are logged on the server so the logs contain the failure details.

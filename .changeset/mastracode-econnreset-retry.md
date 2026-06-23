---
'mastracode': patch
---

MastraCode now automatically retries transient ECONNRESET model stream failures with exponential backoff. Dropped provider sockets recover without manual intervention using a global policy of 2 retries with delays of 1000ms, 2000ms, and 4000ms (capped at 30000ms), applied to all model calls independent of model-pack settings.

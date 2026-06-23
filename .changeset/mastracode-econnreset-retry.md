---
'mastracode': patch
---

MastraCode now automatically retries transient ECONNRESET model stream failures with a short wait. Dropped provider sockets recover without manual intervention using a global policy of 2 retries and a 1000ms wait, applied to all model calls independent of model-pack settings.

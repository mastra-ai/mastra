---
'mastracode': patch
---

Route all web UI fetches (auth, GitHub, project resolution) through the injected API base URL so requests reach the backend when the dev frontend and server run on different ports.

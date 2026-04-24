---
'@mastra/auth-workos': patch
---

Improved WorkOS FGA bearer-token support by standardizing memory authorization on the thread resource key, keeping legacy aliases working, and allowing verified JWT claims to carry service-token FGA context such as organization membership IDs.

---
'@mastra/deployer': patch
---

The /api route was returning 401 instead of 200 because it was being caught
by the /api/_ protected pattern. Adding it to the default public routes
ensures the root API endpoint is accessible without authentication while
keeping /api/_ routes protected.

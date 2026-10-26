---
'@mastra/core': patch
---

Fixed durable and evented agents recording raw provider usage on model_step spans. Cache reads now appear under inputDetails.cacheRead like the regular agent, so prompt-cache dashboards no longer show 0% for these agents.

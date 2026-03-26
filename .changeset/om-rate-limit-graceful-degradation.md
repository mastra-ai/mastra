---
'@mastra/memory': patch
---

Fixed observational memory errors (e.g. rate limits) blocking the entire agent response. Previously, if the OM model failed, the agent would abort with a tripwire — even if the main model was working fine. Now OM errors degrade gracefully: the agent continues without observations, a non-blocking warning is shown, and a circuit breaker temporarily disables OM after repeated failures to avoid spamming a broken API.

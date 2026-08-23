---
'@mastra/server': patch
---

The agent-controller models endpoint now includes an optional `noKeyNeeded` flag on each model, letting clients distinguish models that run without any provider credential (free tiers) from models whose key is merely unset.

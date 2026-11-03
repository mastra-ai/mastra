---
'@mastra/code-sdk': patch
---

Reading the code agent's model without a controller session no longer logs "Tenant model credential policy could not be resolved". This happens when a host checks the agent's model at startup with an empty request context. The read now fails with "No model available" and skips the tenant check. Reads from a session still run the tenant check.

---
'@mastra/factory': patch
---

Fixed Slack observational memory choosing a fallback model from the Factory project provider instead of the linked sender's selected model provider. Slack sessions now use a low-cost observational-memory model compatible with the sender's credentials while keeping the Factory project model as the independent run-model fallback.

---
'@mastra/factory': patch
---

Fixed Slack observational memory choosing a fallback model from the Factory project provider instead of the linked sender's selected model provider. New and restarted Slack sessions now use a low-cost observational-memory model compatible with the model they actually run, while keeping the Factory project model as the independent run-model fallback and realigning memory if a sender model switch fails.

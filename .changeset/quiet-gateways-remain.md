---
'@mastra/core': patch
---

Preserved the gateway prefix when serializing routed models for durable execution. Restoring a saved model or fallback list now uses its original routing identifier without storing credentials or transport configuration.

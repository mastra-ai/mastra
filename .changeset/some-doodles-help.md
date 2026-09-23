---
'@mastra/core': minor
---

Added ClassifierProcessor for applying typed classifier policies to agent input, output, and streaming content. Registered classifiers can be reused by key or ID, and processor instances receive Mastra context even when another processor uses the same ID.

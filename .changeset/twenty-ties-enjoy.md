---
'@mastra/core': patch
---

Fixed an issue where a custom URL in model router still validated unknown providers against the known providers list. Custom URL means we don't necessarily know the provider. This allows local providers like Ollama to work properly

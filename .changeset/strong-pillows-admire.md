---
'@mastra/memory': patch
'@mastra/core': patch
---

Fixed gateway model detection to use duck typing instead of instanceof check, preventing potential failures from cross-package module resolution issues. Propagates `gatewayId` through the AISDKV5LanguageModel wrapper so duck-type detection works even when models are re-wrapped.

---
'@mastra/core': patch
---

Fixed images and files returned by tools being dropped when a router model resolves to a LanguageModelV4 provider. Tool-result media is now converted to the V4 file format before it reaches the provider.

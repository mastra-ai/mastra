---
'@mastra/core': patch
---

Fixed a type error that stopped custom gateways and `Agent` from accepting models built on the current AI SDK provider packages. `@mastra/core` shipped type definitions that vendored `@ai-sdk/provider` 4.0.35, so a model built on `@ai-sdk/provider` 4.0.36 or newer — where the opt-in `ping` stream part was added — was rejected when returned from `MastraModelGateway.resolveLanguageModel` or passed as `new Agent({ model })`. The vendored definition now tracks 4.0.38 ([#30454](https://github.com/mastra-ai/mastra/issues/30454)).

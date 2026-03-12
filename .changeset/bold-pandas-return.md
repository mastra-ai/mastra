---
'@mastra/core': patch
---

Fixed provider tools (e.g. `openai.tools.webSearch()`) being silently dropped when using a custom gateway that returns AI SDK v6 (V3) models. The router now remaps tool types from `provider-defined` to `provider` when delegating to V3 models, so provider tools work correctly through gateways. Fixes #13667.

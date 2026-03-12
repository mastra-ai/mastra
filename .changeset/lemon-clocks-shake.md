---
'@mastra/core': patch
---

Fixed reasoning text being lost after memory round-trip for OpenRouter models. When reasoning parts had empty text fields (common with xai/Grok's `reasoning.summary` format), `convertMessages(...).to("AIV5.UI")` now recovers the original content from `providerMetadata.reasoning_details`. Fixes #14094.

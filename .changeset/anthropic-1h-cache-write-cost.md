---
'@mastra/core': patch
'@mastra/observability': patch
---

Fixed cost estimates for Anthropic 1-hour prompt-cache writes. The 5-minute and 1-hour cache-write token counts are now read from the provider's raw usage, so 1-hour writes are priced at their real rate instead of the cheaper 5-minute rate. ([#25011](https://github.com/mastra-ai/mastra/issues/25011))

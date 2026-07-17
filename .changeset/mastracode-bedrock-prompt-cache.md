---
'@mastra/code-sdk': patch
---

Enable prompt caching on the Amazon Bedrock path.

mastracode only wired prompt caching for its Anthropic providers (via `providerOptions.anthropic.cacheControl`); the Bedrock path had none. Because `@ai-sdk/amazon-bedrock` reads a different key (`providerOptions.bedrock.cachePoint`), long agentic threads on Bedrock re-paid full-price input on every turn instead of the cache-read rate — a ~10x input-cost increase on large threads.

`AmazonBedrockGateway` now wraps its models with a middleware that inserts Bedrock cache points at the last system message and the most recent message (mirroring the Anthropic path's two breakpoints). Models that don't support cache points ignore the field.

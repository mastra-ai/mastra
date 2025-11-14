---
'@mastra/ai-sdk': patch
---

Add sendStart, sendFinish, sendReasoning, and sendSources options to toAISdkV5Stream function, allowing fine-grained control over which message chunks are included in the converted stream. Previously, these values were hardcoded in the transformer.

BREAKING CHANGE: AgentStreamToAISDKTransformer now accepts an options object instead of a single lastMessageId parameter

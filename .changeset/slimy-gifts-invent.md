---
'@mastra/ai-sdk': major
---

Add sendStart, sendFinish, sendReasoning, and sendSources options to toAISdkV5Stream function, allowing fine-grained control over which message chunks are included in the converted stream. Previously, these values were hardcoded in the transformer.

BREAKING CHANGE: AgentStreamToAISDKTransformer now accepts an options object instead of a single lastMessageId parameter

Also, add sendStart, sendFinish, sendReasoning, and sendSources parameters to
chatRoute function, enabling fine-grained control over which chunks are
included in the AI SDK stream output.

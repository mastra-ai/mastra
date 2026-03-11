---
'@mastra/core': patch
---

Fixed provider-executed tools (e.g. OpenAI web_search, Anthropic skills) incorrectly triggering additional agentic loop iterations, causing duplicate API requests and errors. Also fixed providerMetadata (such as OpenAI item IDs) being lost during streaming, which prevented the SDK from using efficient item_reference format for tool calls in multi-turn conversations.

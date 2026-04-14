---
'@mastra/core': patch
---

Upgraded model router providers to AI SDK v3 spec: OpenAI, Anthropic, Google, xAI, Groq, and Mistral now use the latest v6 SDK packages. Providers built on `openai-compatible` (Cerebras, DeepInfra, DeepSeek, Perplexity, TogetherAI) remain on v2 spec until their base package is updated. All provider packages (both v5 and v6) bumped to their latest stable patch versions.

Fixed 'item missing its reasoning part' error for OpenAI reasoning models (gpt-5-mini, gpt-5.2). The v5 SDK couldn't serialize reasoning items for OpenAI's Responses API, so Mastra stripped them from prompts — but this caused errors in multi-turn conversations with memory enabled. With v3 providers, reasoning items are serialized natively and the stripping workaround has been removed.

---
'@mastra/core': patch
---

Fixed 'item missing its reasoning part' error for OpenAI reasoning models (gpt-5-mini, gpt-5.2) by upgrading model router providers to AI SDK v3 spec and preserving reasoning items in LLM prompts.

**What changed:**

- Upgraded OpenAI, Anthropic, Google, xAI, Groq, and Mistral providers to v3 spec (AI SDK v6). Providers built on `openai-compatible` (Cerebras, DeepInfra, DeepSeek, Perplexity, TogetherAI) remain on v2 spec.
- Removed reasoning-stripping workaround from prompt generation. The v5 SDK couldn't serialize reasoning items correctly for OpenAI's Responses API, so Mastra stripped them — but this caused errors in memory-loaded multi-step conversations where some item references leaked without their paired reasoning.
- With v3 providers, reasoning items are serialized natively via `item_reference`, and OpenAI resolves them server-side.

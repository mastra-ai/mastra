---
'@mastra/core': patch
---

Fixed Anthropic thinking block signatures being replayed to the LLM, causing 'Invalid signature in thinking block' API errors. Anthropic reasoning parts with cryptographic signatures are now stripped from LLM prompts (matching the existing OpenAI reasoning stripping pattern), while being preserved in database storage and UI display.

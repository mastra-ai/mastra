---
'@mastra/core': patch
---

Fixed `System message must be at the beginning` errors with strict chat-template models (e.g. Qwen3.x on vLLM) behind OpenAI-compatible providers. Prompts sent to OpenAI-compatible providers now contain a single leading system message: instructions, processor and workspace/skills system prompts are merged in order, and any later system message is sent as a `<system-reminder>` user message. Anthropic, Google and Bedrock prompts are unchanged.

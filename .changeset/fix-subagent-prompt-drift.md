---
'@mastra/core': patch
---

Sub-agent tool calls no longer fail when LLMs use `query`, `message`, or `input` instead of `prompt` during repeated sub-agent calls via custom gateways. These common aliases are now automatically recognized and mapped to `prompt` when the schema expects it.

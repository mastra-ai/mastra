---
'@mastra/core': patch
---

Fixed an infinite tool-call loop when using OpenAI models with optional fields in nested objects. When the LLM omits inner fields of a nested object (sends `{}` instead of `{ "field": null }`), validation would reject the input with "Required" errors, causing the agent to retry endlessly. Tool input validation now detects absent nullable fields and fills them with `null` before validation, allowing the existing transform pipeline to restore the original optional semantics.

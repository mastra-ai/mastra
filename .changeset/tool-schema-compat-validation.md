---
'@mastra/core': patch
---

Fixed tool execute-time input validation for Zod tools on provider-compat models (for example Anthropic Claude 3.5 Haiku). Validation now uses the same compat-transformed schema the LLM receives, so tool calls are not rejected for constraints that were stripped from the model-facing schema.

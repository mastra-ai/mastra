---
"@mastra/core": patch
---

Agents using structured output no longer fail when workflow tools are present. Setting toolChoice to 'none' now correctly prevents tools from being sent to the provider, fixing errors from providers like Gemini that reject structured output requests when tools are included.

---
'@mastra/core': patch
---

Fixed `structuredOutput.jsonPromptInjection: false` being ignored when a structuring `model` is set. The main model's prompt no longer receives the full JSON schema on every step when you opt out of injection.

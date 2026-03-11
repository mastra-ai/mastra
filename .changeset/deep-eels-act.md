---
'@mastra/core': patch
---

Fixed OpenAI reasoning models (e.g. gpt-5-mini) failing with "function_call was provided without its required reasoning item" when the agent loops back after a tool call. The issue was that `callProviderMetadata.openai` carrying `fc_*` item IDs was not being stripped alongside reasoning parts, causing the AI SDK to send `item_reference` instead of inline `function_call` content.

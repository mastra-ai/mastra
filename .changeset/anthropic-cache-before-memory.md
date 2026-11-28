---
'@mastra/code-sdk': patch
---

Fixed Anthropic requests reading nothing from the prompt cache after observational memory rewrites its observations. Mastra Code now also marks the last system message before memory's context, so the unchanged instructions, tools and skills in front of it stay cached and only memory's part and the conversation are sent again.

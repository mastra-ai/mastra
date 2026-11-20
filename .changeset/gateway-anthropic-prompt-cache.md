---
'@mastra/code-sdk': patch
---

Fixed Anthropic models not sending prompt cache breakpoints when they run through the Mastra Gateway with an organization key. Eligible gateway routes can now reuse the prompt prefix on later steps of a conversation.

---
'@mastra/core': patch
---

Fixed reasoning from later steps being dropped when the reasoning text is empty and the provider stores the reasoning's identity in provider metadata (for example Anthropic, Bedrock and Gemini signatures or redacted thinking). Each distinct reasoning block now stays in the conversation for any provider, and re-adding an identical block is still deduplicated.

---
'@mastra/core': patch
---

Fixed reasoning from later steps being dropped when the reasoning text is empty. This affected providers that store reasoning identity in provider metadata, such as Anthropic, Bedrock and Gemini signatures or redacted thinking. Each distinct reasoning block now stays in the conversation when its metadata has an item ID, signature, redacted data, encrypted content or digest field. Identical reasoning blocks are not added again.

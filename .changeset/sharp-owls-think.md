---
'@mastra/core': patch
---

Fixed reasoning from later steps being dropped when the reasoning text is empty. This affected providers that store reasoning identity outside the text, such as Anthropic, Bedrock and Gemini signatures or redacted thinking. Each distinct reasoning block now stays in the conversation when its provider metadata, provider options or reasoning details have an item ID, signature, redacted data, encrypted content or digest field. Identical reasoning blocks are not added again.

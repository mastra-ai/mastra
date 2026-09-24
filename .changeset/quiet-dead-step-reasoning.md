---
'@mastra/core': patch
---

Fixed threads getting stuck on Anthropic and Bedrock after a step failed mid-reasoning. Prompts now leave out reasoning that the provider cannot accept, so later turns no longer fail.

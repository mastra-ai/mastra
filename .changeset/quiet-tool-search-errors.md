---
'@mastra/core': patch
---

Fixed provider tool errors being sent back to the model as successful results. When a provider-run tool returns an error, Mastra now saves it as an error and sends it back as an error in later steps and recalled conversations.

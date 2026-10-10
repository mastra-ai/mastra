---
'@mastra/core': patch
---

Fixed threads breaking after a provider tool fails. When a provider-run tool such as Anthropic tool search returns an error, later steps and recalled conversations now send that error back to the model correctly. Before, the model received it as a successful result, and every later step in the thread failed.

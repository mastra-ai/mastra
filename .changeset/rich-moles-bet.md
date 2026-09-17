---
'@mastra/code-sdk': patch
---

Fixed Mastra Code providers appearing disconnected in Studio after OAuth login. Provider status reads the gateway's current credential store without refreshing tokens, resolving model auth, or depending on a model list.

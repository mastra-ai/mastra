---
'@mastra/core': patch
---

Fixed workflow restart failing when a nested step's durable snapshot was already terminal but the parent still listed it as active. Restart now reuses the child's stored result instead of throwing 'This workflow run was not active'. See https://github.com/mastra-ai/mastra/issues/20225

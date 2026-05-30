---
'@mastra/memory': patch
---

Include role, content, and created_at in vector embedding metadata when saving and updating messages, so consumers that build search results directly from vector metadata get complete message data instead of only the lookup ids.

---
'@mastra/core': patch
---

Fixed passing CoreMessages to stream/generate where the role is not user. Previously all messages would be rewritten to have role: "user"

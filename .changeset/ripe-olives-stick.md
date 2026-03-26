---
'@mastra/client-js': patch
---

Fixed AgentVoice.speak() sending incorrect field name `input` instead of `text` in the request body, which caused speech generation requests to fail

---
'@mastra/playground-ui': patch
'mastra': patch
---

Remove hardcoded temperature: 0.5 and topP: 1 defaults from playground agent settings
Let agent config and provider defaults handle these values instead

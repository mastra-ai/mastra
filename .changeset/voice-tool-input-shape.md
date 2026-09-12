---
'@mastra/voice-openai-realtime': patch
'@mastra/voice-aws-nova-sonic': patch
---

Voice tools built with `createTool` now receive their arguments as the first parameter, matching `ToolExecuteFunction`. The realtime adapters wrapped them in `{ context: args }`, so every field the tool read was undefined and a tool that validated its input failed the call. Fixes #23723.

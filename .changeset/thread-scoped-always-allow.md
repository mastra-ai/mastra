---
'@mastra/server': patch
'@mastra/client-js': patch
---

The Agent Controller tool-approval endpoint now accepts `alwaysAllowCategory: true`, which approves the call and grants its tool category to the call's thread, the same way "always allow" works in an in-process session. Pass it from `@mastra/client-js` with `session.approveTool(toolCallId, true, { alwaysAllowCategory: true })`.

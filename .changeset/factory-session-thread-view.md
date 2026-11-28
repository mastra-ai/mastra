---
'@mastra/playground-ui': minor
---

Add the Factory session thread view at `@mastra/playground-ui/domains/factory/session/thread`. `SessionView` renders a thread's transcript, composer, status line and goal panel from chat contexts and a `SessionHostContext`, so any agent runtime can mount it by providing those contexts. Goal, thread list, thinking, model switching and permissions are optional and hidden when the host doesn't provide them.

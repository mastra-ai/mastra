---
'@mastra/code-sdk': patch
---

Fire the `SessionStart` hook again when a session binds a different thread, with `source: 'thread_change'` (the boot event now carries `source: 'startup'`). Integrations that track sessions, such as Herdr's status hook, learned only the `session-init` placeholder before, so a session started without a thread to resume dropped every later status report. Other hooks of the new thread wait for this event, so the new session ID always arrives first.

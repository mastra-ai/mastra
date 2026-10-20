---
'@mastra/factory': patch
---

Added a **Processes** view to the workspace sidebar, under Files.

- Lists what is running in the session's sandbox, plus processes that exited but whose output hasn't been read yet, with a running count in the sidebar.
- Opening a process shows its stdout and stderr while it runs, and a **Stop** button.
- Viewing a process doesn't use up its output: the agent can still read it afterwards.
- Hidden when the session's sandbox can't manage processes. When the sandbox is asleep, it offers **Wake sandbox** instead of starting it.

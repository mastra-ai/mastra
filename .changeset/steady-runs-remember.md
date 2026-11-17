---
'@mastra/core': patch
---

A resume that leaves out `autoResumeSuspendedTools` now keeps the setting the run last paused with, also when another server process or a restarted one resumes it. A run that turned auto-resume off keeps holding a later message for an explicit resume. Part of the fix for [#30190](https://github.com/mastra-ai/mastra/issues/30190).

A resume on a run's open stream that names no thread now continues on the run's own thread and keeps the memory settings it does not pass.

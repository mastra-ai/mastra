---
'@mastra/factory': patch
---

Factory now links every comment and change request it publishes back to the session that wrote it. The pull request "Reviewing…" status comment shows the session link from the moment the review starts and keeps it after the review ends. GitHub triage comments get the link added automatically. Triage on Linear and Jira, build, and self-review end what they publish with the same link, taken from a new `Your session` line in the work item signal. Session links appear only when `MASTRACODE_PUBLIC_URL` is set.

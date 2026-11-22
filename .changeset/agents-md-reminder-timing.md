---
'@mastra/core': patch
---

Inject AGENTS.md reminders immediately after the relevant tool results, rather than replaying old results on later turns. Deduplicate against persisted thread reminders even outside the loaded history window, and allow callers to restrict which tools can trigger reminders.

---
'@mastra/code-sdk': patch
---

Goals are now graded with the session's own model when no goal judge model is configured. Before, a goal set without a judge model (for example from the web UI) never got graded and never finished.

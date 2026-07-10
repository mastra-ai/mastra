---
'@mastra/code-sdk': patch
---

Improved plan mode: agents now resolve open questions with `ask_user` before submitting a plan, instead of leaving unanswered questions in the plan for you to catch after submission. When a written plan still contains assumptions or decisions the agent asks them through the TUI, folds the answers back into the plan file, and only then calls `submit_plan`.

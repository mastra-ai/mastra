---
'@mastra/code-sdk': minor
---

Add goal execution to the headless `runMC` API. Goal runs use the same GoalManager and system-reminder signal path as the TUI and resolve on terminal `goal_evaluation` events without manual continuation messages.

---
'@mastra/factory': minor
---

Factory sessions no longer have modes: Plan and Explore are gone, and every session runs as Build. Mastra Code in the terminal keeps its modes.

- The composer no longer shows a mode picker, and Shift+Tab no longer switches modes. `/settings` no longer prints a mode line.
- A thread last used in Plan or Explore mode reopens in Build mode, so it can still write files.
- Explore subagents in sessions without a default model now use Build mode's default model instead of Explore mode's, like sessions that have a default model already do for every subagent.
- Audit events for runs no longer record an agent name.

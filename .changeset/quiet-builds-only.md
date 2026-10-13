---
'@mastra/factory': minor
---

Removed Build, Plan, and Explore modes from Factory sessions. Every session now runs in Build mode. Mastra Code in the terminal keeps its modes.

- The composer no longer shows a mode picker, and Shift+Tab no longer switches modes. `/settings` no longer prints a mode line.
- A thread last used in Plan or Fast mode reopens in Build mode, so it can still write files.
- Thinking defaults have a single global level. Per-mode thinking defaults no longer apply to Factory runs, and `PUT /web/config/thinking` only accepts `globalDefault`. Per-mode defaults saved by the terminal app stay in the shared settings file.
- Explore subagents in sessions without a default model now use Build mode's default model instead of Explore mode's, like sessions that have a default model already do for every subagent.
- Audit events for runs no longer record an agent name.

---
'@mastra/factory': patch
---

Added the session's history to the Factory sidebar hover card, in place of its branch names.

**What the card shows**

- The owner, and who they took the session over from.
- A link to the issue or pull request.
- What the agent is doing.
- A timeline of stages, agent runs, and the moments a person moved the work or took the session over.
- The name, length, and times of any stage, run, or person you point at on the timeline.

Added `startedAt` to each `factory.run.ended` audit record, so a run's length can be read from its end record alone. Runs that ended before this release have no start time and do not appear on the timeline.

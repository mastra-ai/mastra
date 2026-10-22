---
'@mastra/factory': patch
---

Hovering a session in the Factory sidebar now shows what happened in it, not its branch names. The card shows the owner and who they took it over from, a button to the issue or pull request, what the agent is doing, and one timeline: the stages the work moved through, the agent runs inside them, and avatars where a person moved the work or took the session over.

Each `factory.run.ended` audit record now carries `startedAt`, so a run's length can be read from its end record alone. Runs that ended before this release have no start and are left off the timeline.

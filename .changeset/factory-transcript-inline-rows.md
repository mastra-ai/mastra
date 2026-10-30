---
'@mastra/factory': patch
---

Signal, system reminder and skill rows in the transcript now read like the agent's activity lines: same left edge, same type and weight, a readable name instead of the signal's id, and the message as prose instead of monospace. Activity lines no longer draw a rule under each stretch, so a run of thoughts, tool stretches and signals keeps one even rhythm. A finished stretch of tool calls rests on the agent icon instead of the first tool's icon.

Paths in activity rows read relative to the agent's working directory, such as `packages/core/package.json` instead of the sandbox's absolute path, and details read in the body font rather than monospace. The live activity line writes itself in from the left and rolls to each new call instead of swapping its words at once.

A message sent after a pause of ten minutes or more now shows its "51 minutes later" divider the moment it is sent, above the message. Before, the divider landed after the agent had already started thinking and pushed the reply down.

After sending a message, "Thinking" stays on screen until the reply shows something. Before, the run's thinking line vanished for a few seconds once the model opened a thought with no text yet, then came back.

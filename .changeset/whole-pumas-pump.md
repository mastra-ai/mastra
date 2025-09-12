---
'@mastra/core': patch
---

Deprecate "output" in generate and stream VNext in favour of structuredOutput. When structuredOutput is used in tandem with maxSteps = 1, the structuredOutput processor won't run, it'll generate the output using the main agent, similar to how "output" used to work.

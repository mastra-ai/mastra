---
'@mastra/core': patch
---

Fixed trace trees for agents that use output stream processors. In multi-step runs, each step's output stream processor span now sits inside that step and also covers the step's tool results, instead of every span showing up as a flat list under the agent run. Structured output processor spans stay under the agent run, because structured output runs once on the final result.

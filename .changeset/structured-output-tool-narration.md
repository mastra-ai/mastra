---
'@mastra/core': patch
---

Fixed `structuredOutput` so it only uses the final answer of a run.

- Text an agent writes before calling a tool (like "Let me look that up.") no longer fails validation or ends the run early.
- `stream.object` now resolves to the final answer, not an earlier JSON draft.
- Durable agents now return the final answer instead of the first JSON they saw.

([#25038](https://github.com/mastra-ai/mastra/issues/25038))

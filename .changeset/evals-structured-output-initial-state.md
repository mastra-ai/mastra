---
"@mastra/core": minor
---

Support structured output and workflow initial state in `runEvals`.

- Add `structuredOutput` option for agents using AI SDK v5/v6 models, forwarded to `agent.generate()`.
- Add `output` option for agents using legacy AI SDK v4 models, forwarded to `agent.generateLegacy()`.
- Add `initialState` field to eval data items, forwarded to `run.start()` for workflow targets.

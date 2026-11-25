---
'@mastra/langsmith': minor
---

Fixed LangSmith trajectories missing tool calls, tool results and the final answer, and showing thread title generation as part of the conversation. Multi-turn online evaluators that use `trajectory` now receive the full turn.

Each call to the model provider is now its own `llm` run (`inference: 0`, `inference: 1`, ...), with the conversation up to that call in `inputs.messages` and its own token usage. The run that wraps them (`llm: 'gpt-4o'`) is now a `chain` run. Each token is still counted once.

If a LangSmith filter, rule or evaluator selects model runs by name, or reads `llm` runs expecting one per agent turn, update it. `generateLegacy()` and `streamLegacy()` still send one `llm` run per generation.

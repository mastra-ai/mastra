---
'@mastra/core': patch
'@mastra/inngest': patch
---

Fixed the Inngest durable engine never executing an agent's configured scorers. Core's `createDurableAgenticWorkflow` runs scorers in a post-finish `execute-scorers` step, but that step was never ported to `createInngestDurableAgenticWorkflow` — `initData.scorers` was serialized onto the workflow input and then silently ignored: no scorer runs, no persisted scores, no scorer spans.

Scorer execution now lives in a shared `runDurableScorers` (exported from `@mastra/core/agent/durable`) used by both engines' post-finish steps. Scorers are serialized by name and resolved from the Mastra instance at execution time, so the step is cross-process safe by construction; scorer spans are parented under the run's rebuilt `AGENT_RUN` span rather than the terminal step's internal workflow span.

Adds a cross-process regression test (real connect() worker) asserting a configured scorer executes after the run completes and its score is persisted.

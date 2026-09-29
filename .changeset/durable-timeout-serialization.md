---
'@mastra/core': patch
---

Serialize `modelSettings.timeout` into the durable workflow input. `serializeModelSettings` dropped the `timeout` field entirely, so a durable run's execution time budgets were lost across the serialization boundary: cold recovery (`DurableAgent.recover()`) could not restore the run-level `totalMs` budget — a restarted run lost its configured deadline and ran unbounded — and the per-call `stepMs`/`firstChunkMs` budgets never reached the durable llm-execution step's shared execute wrapper. All three subfields now survive serialization (positive finite numbers only), and a recovered session re-arms the persisted `totalMs` budget.

---
'@mastra/inngest': patch
---

Fixed every Inngest durable run producing two traces, with the preparation-phase `processor_run` spans (custom `processInput` processors, message-history recall and its `memory: recall` child) landing as parentless spans in a rootless second trace. `InngestAgent` called `prepareForDurableExecution` without `mastra` (and without the wrapper's public agent identity), so preparation could not resolve an observability instance and never created the run's `AGENT_RUN` span — and the wrapper then minted its own duplicate `AGENT_RUN`/`MODEL_GENERATION` spans as a separate trace root. `InngestAgent` now passes `mastra` + `durableAgentId`/`durableAgentName` to preparation (mirroring core's `DurableAgent`) and reuses preparation's exported spans instead of creating duplicates, so the whole run lands in one trace.

The `AGENT_RUN` and `MODEL_GENERATION` spans also now record the caller's raw messages as their `input`, matching the non-durable agent, instead of the serialized MessageList state (an internal blob of memory/system/tagged message buckets).

Adds a cross-process regression test (real connect() worker) asserting a single trace per run, `agent_run`-only roots, parented input-processor spans, and a readable `agent_run` input.

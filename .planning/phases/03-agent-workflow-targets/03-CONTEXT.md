# Phase 3: Agent & Workflow Targets - Context

**Gathered:** 2026-01-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Complete integration with Agent.generate() and Workflow.run() for dataset execution. Wire the runDataset orchestrator (from Phase 2) to actually call targets instead of placeholder execution.

</domain>

<decisions>
## Implementation Decisions

### Input Mapping

- Direct pass-through: item.input IS the target input — user responsible for matching schema
- Runtime error on schema mismatch: let target throw, capture as item error
- Workflows: item.input passed as `triggerData` to workflow.run()
- Agents: item.input passed as-is to agent.generate() (supports string or messages[])
- item.context stays metadata only — describes test case, not passed to execution

### Output Capture

- Agents: Store full response object (content, usage, model, finish reason)
- Streaming agents: Collect full response, store final result (same as non-streaming)
- Workflows: Store result + error only (tracing handles step details)
- No latency measurement — rely on existing telemetry

### Error Handling

- Continue with other items on failure (don't abort run)
- No automatic retry for v1
- No timeout for v1
- Serialized error stored: message + name + stack

### Concurrency

- Configurable via option to runDataset
- Default: 1 (sequential) — safe for rate-limited APIs

### Claude's Discretion

- Retry logic if adding later (transient error detection)
- Exact p-map configuration
- Error serialization format (use existing SerializedError pattern)

</decisions>

<specifics>
## Specific Ideas

- Agent execution should mirror manual agent.generate() call exactly
- Workflow execution mirrors manual workflow.run({ triggerData }) call
- Full agent behavior enabled — tools can be called during dataset runs

</specifics>

<deferred>
## Deferred Ideas

- Runtime context propagation (auth, headers) — add when needed
- Per-item context override — future enhancement
- Timeout configuration — add if long-running items become a problem

</deferred>

---

_Phase: 03-agent-workflow-targets_
_Context gathered: 2026-01-24_

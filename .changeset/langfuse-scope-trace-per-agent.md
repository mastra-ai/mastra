---
'@mastra/langfuse': patch
---

**Scope Langfuse traces to the agent or workflow that started them**

The Langfuse exporter now sets trace-level identity on every root span so Langfuse evaluators (such as LLM-as-a-Judge with a trace name or metadata filter) match only the agent or workflow you target, instead of every invocation across all agents.

For each trace whose root span is an `AGENT_RUN`:

- `langfuse.trace.name` defaults to the agent name (or id, when no name is set)
- `langfuse.trace.metadata.agentId` is set to the agent id
- `langfuse.trace.metadata.agentName` is set to the agent name

The same applies to `WORKFLOW_RUN` root spans, which set `langfuse.trace.metadata.workflowId` and `langfuse.trace.metadata.workflowName`.

A custom `traceName` set via `mastra.metadata.traceName` still takes precedence over the agent default.

In Langfuse, scope an evaluator to a specific agent by filtering on:

- **Trace name** equals the agent name (for example, `weather-agent`)
- **Metadata** `agentId` equals the agent id

Resolves [#15263](https://github.com/mastra-ai/mastra/issues/15263).

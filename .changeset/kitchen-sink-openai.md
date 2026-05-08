---
'@internal/playground': patch
---

Kitchen-sink optional live OpenAI uses the budget default `gpt-5-nano` (not `gpt-4o`). Without `OPENAI_API_KEY`, deterministic mocks and CI stay unchanged.

Set `KITCHEN_SINK_TRACE=1` to enable verbose Mastra logs (Pino `debug`) when debugging hangs; avoid `@mastra/observability` in this package because `mastra dev` bundles to `.mastra/output` with externals and Node often cannot resolve that package from the bundle path under pnpm workspaces.

The `workflow-agent-demo` kitchen-sink workflow uses foreach passes that invoke embedded agents, then a conditional branch — iterations include real agent/memory traffic for Studio transcripts.

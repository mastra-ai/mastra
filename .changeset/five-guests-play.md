---
'@mastra/core': minor
---

Added `runHeadless` orchestrator and output-formatter helpers (`formatText`, `formatJson`, `formatStreamJson`, `hasWarnings`) to `@mastra/core/harness` for running agents in headless mode with `text`, `json`, or `stream-json` output formats. The `json` mode emits the full agent output (the shape returned by `agent.generate()`/`agent.stream()`) as a single JSON line; `stream-json` emits each chunk as NDJSON.

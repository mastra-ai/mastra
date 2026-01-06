---
'@mastra/core': patch
---

Ensures that data chunks written via `writer.custom()` always bubble up directly to the top-level stream, even when nested in sub-agents. This allows tools to emit custom progress updates, metrics, and other data that can be consumed at any level of the agent hierarchy.

- **Added bubbling logic in sub-agent execution**: When sub-agents execute, data chunks (chunks with type starting with `data-`) are detected and written via `writer.custom()` instead of `writer.write()`, ensuring they bubble up directly without being wrapped in `tool-output` chunks.

- **Added comprehensive tests**:
  - Test for `writer.custom()` with direct tool execution
  - Test for `writer.custom()` with sub-agent tools (nested execution)
  - Test for mixed usage of `writer.write()` and `writer.custom()` in the same tool

When a sub-agent's tool uses `writer.custom()` to write data chunks, those chunks appear in the sub-agent's stream. The parent agent's execution logic now detects these chunks and uses `writer.custom()` to bubble them up directly, preserving their structure and making them accessible at the top level.

This ensures that:

- Data chunks from tools always appear directly in the stream (not wrapped)
- Data chunks bubble up correctly through nested agent hierarchies
- Regular chunks continue to be wrapped in `tool-output` as expected

---
'@mastra/core': patch
---

Fixed durable agents dropping tool results when a tool's `toModelOutput` returns `undefined`.

Tools that only map some of their results — including the built-in workspace `read_file` tool and the sandbox tools — return `undefined` from `toModelOutput` to mean "send the raw result as-is". Durable runs stored that `undefined` as the tool's model output, so the next request to the provider carried a tool message with no `output` field and the run failed with `Cannot read properties of undefined (reading 'type')`. Any multi-step durable task that read a file hit this. Regular agents were never affected.

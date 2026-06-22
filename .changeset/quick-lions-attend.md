---
'@mastra/core': patch
'@mastra/mysql': patch
---

Hardened item-level tool mocks for dataset experiments:

- A mocked tool that is mis-called (`TOOL_MOCK_MISMATCH` / `TOOL_MOCK_EXHAUSTED`) now aborts the agent run immediately, so the model cannot go on to call later tools — including unmocked, side-effecting tools that would otherwise run live.
- Ordered consumption of repeated `(toolName, args)` mocks is now deterministic: tools execute sequentially while an item has mocks, so they are consumed in the provider's call order (the previous hook-arrival mutex did not guarantee this).
- The MySQL storage adapter, which does not persist tool mocks, now rejects dataset writes that carry `toolMocks` and experiment results that carry a `toolMockReport` with a clear error, instead of silently dropping them and running tools live.

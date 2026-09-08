---
'@mastra/code-sdk': patch
---

Truncate oversized MCP tool results for the model. Unlike mastracode's workspace tools (capped at ~2k tokens), MCP servers return unbounded results — a chrome-devtools accessibility snapshot or web page extraction can be 30-100k tokens, dominating the agent's context window and observational memory's pending-token accounting. MCP tools are now wrapped with a `toModelOutput` that caps model-facing text at 10k tokens using head+tail truncation with a notice; results under the cap, and results containing media parts, are untouched, and the full result is always preserved for display and storage.

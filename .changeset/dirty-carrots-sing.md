---
'@mastra/core': patch
---

Fixed `requestContext` not being passed to child spans in `getOrCreateSpan`. When an agent runs inside a workflow, child spans (e.g. `agent_run`) were not enriched with metadata from `requestContext` because it was destructured out of options but never forwarded to `createChildSpan`. Now `requestContext` is correctly passed through, ensuring all spans in a trace have their metadata enriched via the configured `requestContextKeys`. Fixes #12818.

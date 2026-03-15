---
'@mastra/core': patch
---

Fixed streamed tool-call arguments being silently discarded when the JSON was slightly malformed, causing tools to receive empty input and triggering unnecessary retries. Tool-call arguments are now sanitized and repaired consistently across both streaming and non-streaming paths.

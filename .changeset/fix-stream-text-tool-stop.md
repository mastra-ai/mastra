---
'@mastra/core': patch
---

Fixed `stream.text` and the last step's text becoming empty when an output processor is configured and the run stops on a step that has both text and a tool call. The assistant text is kept, and a processor that rewrites or clears that text still applies. Fixes [#24917](https://github.com/mastra-ai/mastra/issues/24917).

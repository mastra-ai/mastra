---
'@mastra/core': patch
---

Fixed structured-output streaming blocking the event loop on long outputs. Partial objects were re-parsed from the full accumulated text on every text chunk, so total work grew quadratically — a model that streamed valid JSON followed by a long run of whitespace could stall a server for minutes. Whitespace-only chunks no longer trigger a re-parse, and once the output exceeds 4 KB partial parsing runs only after the text has grown meaningfully. A final partial object is still emitted before the result, and the final object is unchanged. Outputs under 4 KB still emit a partial object for every non-whitespace chunk that changes the value.

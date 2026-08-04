---
'mastra': minor
---

Added `mastra experiment build` to create standalone companion-worker artifacts for running experiments without an HTTP server. For example, run `mastra experiment build --output-dir .mastra/experiment-worker`, then send versioned NDJSON requests on standard input and read protocol events from standard output.

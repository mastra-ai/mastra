---
'@mastra/playground-ui': minor
---

Added a Download trace JSON button to the trace detail panel in Studio. It saves the entire trace — every span with its full input, output, metadata, and attributes — to a `trace-<id>.json` file, so you can share a trace, attach it to a bug report, or build an eval dataset offline. Previously only individual IDs and per-section values could be copied.

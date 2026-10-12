---
'@mastra/langsmith': patch
---

Fixed the LangSmith exporter sending more than one update per run. Span updates now only change the local run, and a single update with the final outputs, metadata and end time is sent when the span ends. Before, LangSmith dropped or rejected the final update, so traces kept partial outputs and a wrong end time.

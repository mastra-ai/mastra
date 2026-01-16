---
'@mastra/otel-exporter': minor
---

Export getAttributes and getSpanName GenAI semantic convention helpers

These functions were previously internal but are now exported to support:
- The new @mastra/sentry exporter which uses them for consistent attribute formatting
- Custom exporter implementations that want to follow GenAI semantic conventions

---
'@mastra/datadog': patch
---

Fixed error spans showing as [object Object] in Datadog UI. The exporter now sets native dd-trace error tags (error.message, error.type, error.stack) so Datadog's Error Tracking UI displays the full error banner with message, type, and stack trace.

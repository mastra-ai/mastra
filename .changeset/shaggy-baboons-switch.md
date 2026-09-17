---
'@mastra/otel-exporter': patch
---

Fixed the OTEL exporter dropping authored workflow control-flow identity. Workflow step, conditional, parallel, loop and sleep spans now export `entryId`, `entryDescription` and `entryMetadata` as `mastra.<span_type>.entry_id`, `entry_description` and `entry_metadata` attributes (metadata is JSON-serialized, preserving nested values and `false`/`0`), so the names, descriptions and metadata you author on workflow entries are visible in OTEL backends like Langfuse. Fixes https://github.com/mastra-ai/mastra/issues/24116

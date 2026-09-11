---
'@mastra/otel-exporter': patch
---

Fix workflow traces losing detail when exported to Langfuse and other OpenTelemetry backends.

Previously, every step and branch in a workflow trace showed up under the parent workflow's name, so sibling steps and conditions were indistinguishable. Branch, loop, sleep, and wait-event details were also dropped.

Now each step keeps its own name, control-flow spans keep their descriptive names, and their metadata is included in the export. Fixes #23579.

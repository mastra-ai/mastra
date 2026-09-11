---
'@mastra/otel-exporter': patch
---

Workflow step and control-flow spans now keep their own identity and metadata when exported through the shared OTEL converter. Previously every workflow step and branch inherited the enclosing workflow's name, so sibling steps and condition evaluations collapsed onto a single name, and the converter had no case for workflow spans so their native attributes (condition counts, truthy/selected indexes, condition index and result, loop/sleep/wait-event fields, step and run status) were dropped entirely. Steps are now named by their step id, control-flow spans keep their authored names, and workflow attributes are exported under the existing `mastra.<span_type>.<snake_case>` convention with arrays/dates serialized and `false`/`0` preserved. Span ids, parent relationships, inputs, outputs and correlation metadata are unchanged. Fixes #23579.

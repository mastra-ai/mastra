---
'@mastra/core': patch
---

Fixed OTEL context propagation for evented workflow step execution and processor phases. Auto-instrumented operations (e.g. AI SDK spans) inside workflow steps and processors now correctly nest under the corresponding step or processor span in distributed traces.

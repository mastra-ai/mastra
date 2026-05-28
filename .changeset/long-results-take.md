---
'@mastra/core': patch
---

Fixed AGENT_RUN observability span not closing when an agent stream is aborted mid-flight (browser disconnect, consumer cancel, or AbortController.abort()). The span now ends with structured output `{ status: 'aborted', reason: 'abort' }` so traces reach Langfuse, Datadog, Braintrust, and other backends that export on SPAN_ENDED. Completes the work started in #17097 for issue #17074.

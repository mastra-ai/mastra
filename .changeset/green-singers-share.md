---
'@mastra/observability': patch
'@mastra/core': patch
---

Fixed tracingOptions.tags not being preserved when merging defaultOptions with call-site options. Tags set in agent's defaultOptions.tracingOptions are now correctly passed to all observability exporters (Langfuse, Langsmith, Braintrust, Datadog, etc.). Fixes #12209.

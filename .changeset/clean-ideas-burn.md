---
'@mastra/observability': patch
---

Fixed stuck spans in Braintrust, LangSmith and PostHog traces. A span that ended right after it started stayed open until shutdown. Shutdown then marked it as failed with 'Observability is shutting down.' This happened, for example, when a tool call failed input validation. These spans now end with their real output. Fixes #26088.

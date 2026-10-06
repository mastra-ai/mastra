---
'@mastra/observability': patch
---

Fixed Braintrust, LangSmith and PostHog traces where a span that ended right after it started stayed open until shutdown, and was then marked as failed with 'Observability is shutting down.' This happened, for example, when a tool call failed input validation. These spans now end with their real output. Fixes #26088.

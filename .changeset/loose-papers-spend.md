---
'@mastra/code-sdk': patch
'mastracode': patch
---

Improved Mastra Code recovery for transient connection and provider server errors with up to 10 retries, exponential backoff starting at 500ms, and visible retry progress in the TUI. Retry timing is now shown only when a retry is actually scheduled.

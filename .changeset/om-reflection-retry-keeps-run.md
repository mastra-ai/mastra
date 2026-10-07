---
'@mastra/core': patch
'@mastra/memory': patch
---

Fixed agent runs stopping with "Interrupted" when an Observational Memory reflection didn't compress enough on its first try. The reflector retries at a stronger compression level, but each retry was reported as a failure, and the agent controller cancelled the run before the retry could finish. Retry attempts are now marked as retrying, so only a final failure stops the run.

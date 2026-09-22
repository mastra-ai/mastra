---
'mastra': patch
---

Fixed `mastra deploy` aborting on temporary server errors or dropped connections while checking deployment status. Status checks now retry with backoff until the polling deadline, including when reading a response fails, and stalled requests are cancelled. The CLI shows a retry notice at most every 30 seconds without erasing streamed deployment logs, confirms when status checks resume, and no longer promises a retry when the deadline has passed. If status cannot be confirmed, it explains that deployment may still be running and links to the deployment dashboard.

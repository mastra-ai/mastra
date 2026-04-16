---
'@mastra/playground-ui': patch
---

Fix unhandled `TypeError` in `getFileContentType` when the URL is relative
or malformed. The `catch` block now falls back to inferring the MIME type
from the raw string's file extension and strips query/hash fragments so
inputs like `/files/report.pdf`, `https://x.dev/a.pdf?token=1`, and
`/files/report.pdf#page=2` all resolve to `application/pdf` instead of
rejecting.

Closes #15432.

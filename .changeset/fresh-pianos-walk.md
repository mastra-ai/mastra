---
'@mastra/core': patch
---

Fixed the workspace `read_file` tool sending a file as an image or PDF based only on its extension. It now checks the first bytes of PNG, JPEG, GIF, WebP and PDF files: an image goes under the type its bytes show, and a file that is not really an image or PDF (for example an HTML error page saved as `.pdf`) is shown as text or as metadata instead. Providers rejected those files with an error that ended the run.

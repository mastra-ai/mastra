---
'mastra': patch
---

Fixed duplicate `mastra dev` runs in the same directory.
Improved startup checks to stop a second dev server early and show a clear message with next steps, instead of surfacing confusing lock errors.

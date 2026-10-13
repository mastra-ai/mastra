---
'@mastra/factory': patch
---

Fixed environment updates that reorder repositories leaving two repositories at the same position. The project fields, settings and every repository change in one `PATCH /web/factory/projects/:id/environment` now save together or not at all, and concurrent reorders apply one after the other.

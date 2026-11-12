---
'mastra': patch
---

Added `mastra api factory work-item starters` and `mastra api factory work-item activity`. The first counts the cards behind each new-session starter on a project's default board. The second lists when a project's cards were created and completed since an instant:

```bash
mastra api factory work-item starters <project-id>
mastra api factory work-item activity <project-id> '{"since":"2026-06-01T00:00:00.000Z"}'
```

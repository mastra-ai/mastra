---
'@mastra/server': patch
---

Fixed auth `rules` so the first rule that matches a request decides access. Before, if a matching rule's `condition` returned false, the next rules were still checked, so a broad rule like `{ path: '/api/*', allow: true }` could let a non-admin into a path guarded by an earlier admin-only rule.

If you relied on that fall-through, combine the checks into a single `condition`.

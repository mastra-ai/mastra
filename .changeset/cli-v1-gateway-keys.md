---
'mastra': patch
'create-mastra': patch
---

Fixed new projects getting an organization (v2) Gateway key, which broke Studio threads with `Gateway API error 404`. New projects now get a Gateway project key, so Studio memory and threads work again.

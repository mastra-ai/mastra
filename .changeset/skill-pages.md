---
'@mastra/client-js': patch
'@internal/playground': patch
---

Add skill create, edit, and view pages to the Agent Builder playground, plus matching `StoredSkill.favorite()`/`unfavorite()` methods on `@mastra/client-js`. The pages and supporting components ship as importable modules; router wiring lands in a follow-up.

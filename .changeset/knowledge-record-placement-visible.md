---
'@mastra/core': patch
'@mastra/libsql': patch
'@mastra/pg': patch
---

`Knowledge.createRecord` and `Knowledge.setRecordScopes` now reject a scope set that would leave the record unreadable. A reader holds a scope plus its parents; the record stays readable when some reader sees one of its scopes, its node and every node the record mentions. A project-scoped record can still be widened to its org, but it can't be created in, or moved to, a scope where no reader sees it. Both calls throw `KnowledgeInvisibleRecordError` and leave the record unchanged.

`listVisibleKnowledgeIds` accepts an optional `recordScopeIds` to judge records as if they had those scopes, so the check uses each store's own visibility rule. Code that writes through `KnowledgeStorage` directly can call `assertKnowledgeRecordScopesVisible` before the write.

---
'@mastra/core': patch
---

`Knowledge.createRecord` and `Knowledge.setRecordScopes` now reject a scope set that would leave the record unreadable. A reader holds a scope plus its parent scopes, and must be able to see both one of the record's scopes and the record's subject node. A record about a project-scoped node can still be widened to its org, but it can no longer be created in, or moved to, an unrelated scope. Both calls throw `KnowledgeInvisibleRecordError` and leave the record unchanged. Storage adapters export the same check as `assertKnowledgeRecordScopesVisible` for callers that write to storage directly.

---
'@mastra/core': minor
'@mastra/libsql': minor
'@mastra/pg': minor
---

Agents can now ask what changed in Knowledge over a period. The new `knowledge_activity` read tool lists page and note changes between `since` and `until`, newest first, with who made each change. It can be narrowed to one page or scope with `from`. Note changes show the note's current text, or that it was removed. Like every other read tool, it only shows changes to pages and notes the run can read.

```ts
// "What changed since Q3?"
await tools.knowledge_activity.execute({ since: '2026-07-01' });
```

`listPageActivity` accepts `since`, `until` and a `before` position, and stores report `supportsActivityDateRange` when they handle them. In-memory, LibSQL and PostgreSQL support it. The tool refuses stores without it rather than return unbounded history. Reads without dates are unchanged.

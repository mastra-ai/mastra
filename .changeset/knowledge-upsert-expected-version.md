---
'@mastra/core': minor
---

`Knowledge.upsertPage` takes an optional `expected: { id, version }`, the page as you read it. With it, the call finds the page at `scope#path`, refuses unless it is that page at that version, and then updates that page by id, only while it is still at that version. If the page was edited, moved, removed or replaced by a new page at the same path since, the call throws `KnowledgeConflictError` and writes nothing: no page, parent page or scope is created. The path is checked when the page is looked up; if a parent page is moved between that lookup and the write, the write follows the page to its new place. A sync that reads a page and writes it later no longer replaces an edit someone made in between.

```ts
const { page } = await knowledge.upsertPage({ scope: 'docs:acme', path: 'faq', name: 'FAQ', body: 'placeholder' });
// ...later, only if nobody has written the page since:
await knowledge.upsertPage({
  scope: 'docs:acme',
  path: 'faq',
  name: 'FAQ',
  body,
  expected: { id: page.id, version: page.version },
});
```

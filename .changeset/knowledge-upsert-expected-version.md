---
'@mastra/core': patch
---

`Knowledge.upsertPage` takes an optional `expectedVersion`. With it, the write happens only if the page is still at that version; otherwise, including when the page has been removed, it throws `KnowledgeConflictError` and writes nothing. A sync that read a page, then wrote it later, no longer replaces an edit someone made in between.

```ts
const { page } = await knowledge.upsertPage({ scope: 'docs:acme', path: 'faq', name: 'FAQ', body: 'placeholder' });
// ...later, only if nobody has written the page since:
await knowledge.upsertPage({ scope: 'docs:acme', path: 'faq', name: 'FAQ', body, expectedVersion: page.version });
```

---
'@mastra/core': minor
---

`Knowledge.removePage` takes an optional `expected: { id, version }`, the page as you read it, the same as `upsertPage`. With it, the call deletes the page at `scope#path` only if it is still that page at that version. If someone edited or removed it, or a new page replaced it at that path, before or during the call, it throws `KnowledgeConflictError` and deletes nothing. A sync that checks a page and deletes it later no longer deletes someone else's write.

```ts
await knowledge.removePage({ scope: 'docs:acme', path: 'faq', expected: { id: page.id, version: page.version } });
```

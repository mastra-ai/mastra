---
'@mastra/core': minor
---

Added `knowledge.upsertPage()`, `knowledge.removePage()`, `knowledge.addNote()`, `knowledge.updateNote()` and `knowledge.removeNote()` so apps can sync outside content, such as docs, into Knowledge from server code. A page is identified by its scope and key path, so running a sync again updates the same pages and skips unchanged ones. Notes on synced pages are kept, pages are embedded when Knowledge has a vector store, and change listeners are told.

```ts
await knowledge.upsertPage({ scope: 'docs:acme', path: 'guides/install', name: 'Install', body: markdown });
await knowledge.removePage({ scope: 'docs:acme', path: 'guides/old' });

const note = await knowledge.addNote({ scope: 'docs:acme', path: 'guides/install', text: 'Needs Node 20.' });
await knowledge.updateNote({ id: note.id, text: 'Needs Node 22.' }); // returns a note with a new id
```

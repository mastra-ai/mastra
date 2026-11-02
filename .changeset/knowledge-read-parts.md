---
'@mastra/core': minor
---

`knowledge_read` returns at most 5,000 tokens of a page body at a time and says how much is left, so a long page no longer fills the context. An agent can ask for the body's `outline` (headings with their sizes), read one `section`, read only the sections that `match` a term, and continue from `bodyOffset`.

```ts
knowledge_read({ page: 'docs:acme#models/anthropic', outline: true });
knowledge_read({ page: 'docs:acme#models/anthropic', section: 'contextManagement' });
knowledge_read({ page: 'docs:acme#models/anthropic', match: 'excludeTools' });
```

Every Knowledge read result now lists anything it cut short in `more`, with how to get the rest: the body, notes, child pages (continue with `knowledge_list`), notes that mention the page (new `mentionedInCursor`), and search results at their limit.

A whole-page read keeps a page's notes, and the notes on other pages that mention it, only while each list stays under 1,000 tokens. A longer list is left out and counted in `more`; read it on its own with `notes: true` or `mentionedIn: true`. A read with `cursor` or `mentionedInCursor` now returns only those notes, without repeating the body.

A read that returns only part of a body (a truncated window or a section) also returns that part's `bodyRange`. `knowledge_page` accepts the same `bodyRange` with `expectedVersion` and replaces only that part of the body. A `knowledge_page` body write without `bodyRange` is refused when the stored body is longer than one read returns, because the writer can only have seen part of it and writing that back would drop the rest.

```ts
const { page } = await knowledge_read({ page: 'docs:acme#models/anthropic', section: 'Setup' });
knowledge_page({ op: 'write', page: page.ref, body: editedSetup, bodyRange: page.bodyRange, expectedVersion: page.version });
```

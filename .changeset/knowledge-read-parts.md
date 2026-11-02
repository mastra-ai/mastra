---
'@mastra/core': minor
---

`knowledge_read` reads long pages by line. A body that fits in one read (1,000 tokens) comes back whole as `body`. A longer one comes back as numbered `lines` (`12│text`) with the `range` they cover and the page's `lineCount`, ending at the last whole line that fits, and `more` says where to read on with `from: { line }`. A line too long for one read, such as a wide table row, is cut by column (`from: { line, col }`). An agent can also ask for the body's `outline` (headings with their line numbers and sizes), read one `section`, or `match` one or more terms like grep: only the lines that contain them, with `context` lines before and after (default 2).

```ts
knowledge_read({ page: 'docs:acme#models/anthropic', outline: true });
knowledge_read({ page: 'docs:acme#models/anthropic', section: 'contextManagement' });
knowledge_read({ page: 'docs:acme#models/anthropic', match: ['excludeTools', 'cacheControl'], context: 3 });
knowledge_read({ page: 'docs:acme#models/anthropic', from: { line: 120 } });
```

Every Knowledge read result now lists anything it cut short in `more`, with how to get the rest: the body, notes, child pages (continue with `knowledge_list`), notes that mention the page (new `mentionedInCursor`), and search results at their limit.

A whole-page read keeps a page's notes, and the notes on other pages that mention it, only while each list stays under 1,000 tokens. A longer list is left out and counted in `more`; read it on its own with `notes: true` or `mentionedIn: true`. A read with `cursor` or `mentionedInCursor` now returns only those notes, without repeating the body.

Every part of a body a read returns comes with its `range`. `knowledge_page` takes a `range` with `expectedVersion` and replaces only those lines with `body`; an empty `body` removes them. A range may be the one a read returned or a smaller one inside it, but not wider than one read from its first line shows, so text the writer never saw can't be overwritten. A body write without a range is refused when the stored body is longer than one read returns, and so is a body that still carries the read's line numbers.

```ts
const { page } = await knowledge_read({ page: 'docs:acme#models/anthropic', section: 'Setup' });
knowledge_page({ op: 'write', page: page.ref, body: editedSetup, range: page.range, expectedVersion: page.version });
```

The per-result cap is configurable: `tools: { read: { maxTokens: 3000 }, write: true }` sets how many estimated tokens one `knowledge_read` body window or match result, and one `knowledge_list` result, returns (default 1,000, at least 100). The write guard for line ranges follows the same cap.

```ts
const knowledge = new Knowledge({ scopes, tools: { read: { maxTokens: 3000 }, write: true } });
```

---
'@mastra/core': minor
'@mastra/libsql': patch
'@mastra/pg': patch
'@mastra/mysql': patch
'@mastra/mongodb': patch
'mastracode': patch
---

Added `knowledge_list`, a Knowledge read tool that lists the page tree under a starting point, so an agent can see how a scope or section is organized before searching. Each entry has the ref `knowledge_read` accepts, its name, description and child count. It goes up to 3 levels deep, takes a `limit` and a `cursor` for wide levels, and says when deeper levels were cut off. A result also stops at about 5,000 tokens of entries, so long descriptions can't flood the context; `more` says how many entries were left out and gives the `cursor` that continues exactly where it stopped, at any depth. Scopes the run can't read are left out. `tools: { read: true }` includes it.

```ts
// Agent tool call
knowledge_list({ from: 'docs:acme#guides', depth: 2 });
// → { from: { ref: 'docs:acme#guides', name: 'Guides' },
//     entries: [{ ref: 'docs:acme#guides/observability', name: 'Observability', depth: 1, children: 2 }, …] }
```

Knowledge storage adapters gained `countChildPages({ parentIds, read })`, which counts the readable child pages under each parent in one query.

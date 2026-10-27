---
'@mastra/code-sdk': minor
'mastracode': minor
'@mastra/factory': minor
---

Mastra Code no longer ships the experimental Subconscious. `MASTRACODE_EXPERIMENTAL_SUBCONSCIOUS` is now `MASTRACODE_EXPERIMENTAL_KNOWLEDGE` (setting the old flag prints a warning and does nothing), and the Subconscious activity view and `ask_memory` tool are removed. Threads that already contain Subconscious activity keep working; the activity is skipped silently.

With `MASTRACODE_EXPERIMENTAL_KNOWLEDGE=1` the code agent gets Knowledge tools (read, write, pin) and pinned knowledge on every turn. Hosts pass their own with `createMastraCode({ knowledge: { instance, scopes } })`, or turn it off with `knowledge: false`:

```ts
const code = await createMastraCode({
  knowledge: { instance: companyKnowledge, scopes: ['org:acme', { scope: 'team:acme:support', access: 'write' }] },
});
```

A plain scope is read-only; `{ scope, access: 'write' }` lets the agent write there. Local sessions write under `org:local` when no scopes are given; Factory sessions always add writable `org:` and `project:` tags.

---
'@mastra/code-sdk': minor
'mastracode': minor
'@mastra/factory': minor
---

Mastra Code no longer ships the experimental Subconscious: the Subconscious activity view and `ask_memory` tool are removed, and `MASTRACODE_EXPERIMENTAL_SUBCONSCIOUS` does nothing. Threads that already contain Subconscious activity keep working; the activity is skipped silently.

Knowledge is opt-in. In the TUI, turn on **Experimental Knowledge** in `/settings` and restart: the code agent gets the Knowledge tools (search, read, write, pin) and pinned context every turn, stored with Mastra Code under a shared `org:local` scope. Hosts attach their own Knowledge the way an Agent does, with `knowledge` and `scopes`, or keep it off with `knowledge: false`:

```ts
const code = await createMastraCode({
  knowledge: companyKnowledge,
  scopes: ['org:acme', { scope: 'team:acme:support', access: 'write' }],
});
```

A plain scope is read-only; `{ scope, access: 'write' }` lets the agent write there. Factory sessions always add writable `org:` and `project:` scopes. Knowledge registers on the mounted Mastra under its `id`; pass `knowledge: { key, instance }` to use another key.

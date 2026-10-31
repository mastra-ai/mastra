---
'@mastra/code-sdk': minor
'mastracode': minor
'@mastra/factory': minor
---

Mastra Code no longer ships the experimental Subconscious: the Subconscious activity view and `ask_memory` tool are removed, and `MASTRACODE_EXPERIMENTAL_SUBCONSCIOUS` does nothing.

Knowledge is opt-in. In the TUI, turn on **Experimental Knowledge** in `/settings` and restart: the code agent gets the Knowledge tools (search, read, write, pin) and pinned context every turn, stored with Mastra Code under a shared `org:local` scope. Hosts attach their own Knowledge the way an Agent does, with `knowledge` and `scopes`, or keep it off with `knowledge: false`:

```ts
const code = await createMastraCode({
  knowledge: companyKnowledge,
  scopes: ['org:acme', 'team:acme:support'],
});
```

Scopes say who the run is; what it may read or write comes from the Knowledge instance's scope declarations. Factory sessions always add `org:` and `project:` scopes, so a Factory Knowledge instance must declare both. Knowledge registers on the mounted Mastra under its `id`; pass `knowledge: { key, instance }` to use another key.

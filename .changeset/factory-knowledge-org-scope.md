---
'@mastra/factory': minor
---

Added `scopes`, the same option as an Agent's `scopes`, passed to every session. With an `org:` scope there, sessions and the Knowledge page act as that org instead of their own `org:` and `project:` scopes, so a Knowledge instance that declares only one org works and all projects share it. A `resource:` or `thread:` scope, or a `project:` beside an `org:`, throws.

```ts
new MastraFactory({ knowledge: new PlatformKnowledge({ tools: true }), scopes: ['org:acme'] });
```

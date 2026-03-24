---
'@mastra/core': patch
---

**Workspace skills now surface all same-named skills for disambiguation.**

When multiple skills share the same name (e.g., a local `brand-guidelines` skill and one from `node_modules`), `list()` now returns all of them instead of only the tie-break winner. This lets agents and UIs see every available skill, along with its path and source type.

**Tie-breaking behavior:**

- `get(name)` still returns a single skill using source-type priority: local > managed > external
- If two skills share the same name _and_ source type, `get(name)` throws an error — rename one or move it to a different source type
- `get(path)` bypasses tie-breaking entirely and returns the exact skill

Agents and UIs now receive all same-named skills with their paths, which improves disambiguation in prompts and tool calls.

```ts
const skills = await workspace.skills.list()
// Returns both local and external "brand-guidelines" skills

const exact = await workspace.skills.get('node_modules/@myorg/skills/brand-guidelines')
// Fetches the external copy directly by path
```

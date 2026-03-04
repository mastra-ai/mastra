---
'@mastra/core': patch
'@mastra/playground-ui': patch
---

**Skill tools now stay available across turns and approval/resume flows.**

- Renamed `skill-activate` to `skill` — returns full instructions directly in the tool result
- Consolidated `skill-read-reference`, `skill-read-script`, and `skill-read-asset` into `skill_read`
- Renamed `skill-search` to `skill_search`
- In Playground UI, renamed `ActivatedSkillsProvider`/`useActivatedSkills` to `LoadedSkillsProvider`/`useLoadedSkills`

**Migration**

| Before | After |
|--------|-------|
| `skill-activate` | `skill` |
| `skill-read-reference` / `skill-read-script` / `skill-read-asset` | `skill_read` |
| `skill-search` | `skill_search` |
| `ActivatedSkillsProvider` | `LoadedSkillsProvider` |
| `useActivatedSkills` | `useLoadedSkills` |

```ts
// Before
toolName: 'skill-activate'

// After
toolName: 'skill'
```

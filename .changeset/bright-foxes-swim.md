---
'@mastra/playground-ui': patch
---

**Updated skill tool detection in playground UI.**

- Detect `skill` tool completion instead of `skill-activate` in tool fallback
- Stabilized `useActivatedSkills` fallback to prevent unnecessary re-renders
- Keyed `ActivatedSkillsProvider` by `agentId-threadId` so state resets across navigations

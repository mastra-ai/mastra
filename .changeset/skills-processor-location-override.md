---
'@mastra/core': patch
---

Pass `formatLocation` to `SkillsProcessor` when skill files are not at `${skill.path}/SKILL.md` from the model's point of view, such as when the agent's filesystem tools run against a sandbox that mounts them elsewhere. Key the override on `skill.path` so skills that share a name still render distinct locations.

```ts
new SkillsProcessor({
  workspace,
  formatLocation: skill => `/mnt/skills${skill.path}/SKILL.md`,
});
```

Remapped locations remain valid skill identifiers: the processor registers each rendered location as an alias with the skills registry, so the `skill` and `skill_read` tools resolve it back to the underlying skill. The skill-tool instruction now also tells the model that `location` may not exist on its filesystem, so it reads skill files with `skill_read` instead of filesystem tools. If a custom `WorkspaceSkills` implementation does not support alias registration, the instruction falls back to directing the model to refer to skills by name.

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

The skill-tool instruction now also tells the model that `location` may not exist on its filesystem, so it reads skill files with `skill_read` instead of filesystem tools. With the default location, the instruction notes that `location` also identifies a skill for the `skill` and `skill_read` tools; when a `formatLocation` override is set, remapped locations are not skill identifiers, so the instruction directs the model to refer to skills by name.

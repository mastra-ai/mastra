---
'@mastra/core': patch
---

Pass `formatLocation` to `SkillsProcessor` when skill files are not at `${skill.path}/SKILL.md` from the model's point of view, such as when the agent's filesystem tools run against a sandbox that mounts them elsewhere.

```ts
new SkillsProcessor({
  workspace,
  formatLocation: skill => `/opt/skills/${skill.name}/SKILL.md`,
});
```

The skill-tool instruction now also tells the model that `location` identifies a skill for the `skill` and `skill_read` tools and may not exist on its filesystem, so it reads skill files with `skill_read` instead of filesystem tools.

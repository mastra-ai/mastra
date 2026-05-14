---
'@mastra/core': minor
---

Harness v1: add `session.skills.use(ref, opts?)` for programmatic skill execution.

Phase 2 of the workspace-sourced Skills API. Resolves a workspace skill by frontmatter `name:` or workspace-relative path, validates declared required args, appends a JSON code block carrying the validated args to the skill body, and dispatches as a single signal-driven turn.

- `session.skills.use(ref, opts?)` — resolves against the configured `WorkspaceSkills` source, runs the skill as a turn, returns the underlying `AgentResult`.
- `UseSkillOptions` type (`args?`, `model?`).
- Tool-facing `ctx.useSkill(ref, opts?)` shorthand on `HarnessRequestContext`.
- New `HarnessSkillArgsValidationError` (`skillName`, `validationError`) for missing required args.
- `HarnessSkill` simplified to workspace-only sourcing: dropped `source` discriminator (only one source in v1), dropped `argsSchema` / `outputSchema` / `defaultMode` (code-registered skills are not part of v1). `HarnessSkillNotFoundError.searchedSources` narrowed to `'workspace'`.
- Sessions with no configured workspace always throw `HarnessSkillNotFoundError` from `use`.

`RemoteSafeSession.skills` exposes `use` only; `list` / `get` / `refresh` remain local-only.

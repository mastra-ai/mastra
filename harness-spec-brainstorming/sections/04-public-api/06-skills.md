### 4.6 Skills

A **skill** is a named, parameterised prompt invoked via `session.useSkill(name, opts)`.

**Skills are session-scoped.** A skill is "available" only when a specific session can resolve its name. Two sources feed that resolution:

- **Code-registered skills** (`HarnessConfig.skills`) — static, deployment-wide, the same for every session under this harness. These are about what your *product* offers (e.g. MastraCode shipping `summarize-pr`, or Devin shipping `clone-and-explore`).
- **Workspace skills** — discovered from the session's workspace at `.claude/skills/<name>/SKILL.md`. These are about what your *project* offers (e.g. a repo shipping `lint-and-format` or `e2e-tests-studio` checked into source control). Whether two sessions share the same set depends on the workspace ownership model (§2.7): a `shared` workspace gives every session the same workspace skills; a `per-resource` workspace partitions them by tenant; a `per-session` workspace gives each session its own.

A session is the thing that has both a harness identity and a workspace identity, so a session is where the two sources meet. The harness has no "execute a skill" method — there's no session for it to execute against. `session.useSkill(name)` is the only invocation surface.

```ts
interface HarnessSkill {
  name: string;                                // Lookup key for `useSkill`
  description: string;                         // Shown in tool catalogues / UIs
  instructions: string;                        // The prompt body. May reference args.
  argsSchema?: ZodSchema;                      // Optional validation for `useSkill({ args })`
  outputSchema?: ZodSchema;                    // Optional default output schema. The
                                               //   per-call `output` option still wins.
  defaultMode?: string;                        // Optional mode override applied for the call
  source: 'config' | 'workspace';              // Origin (set by the harness, not the author)
  filePath?: string;                           // Set when `source === 'workspace'`
}
```

**Resolution.** When `session.useSkill('triage')` is called, the harness resolves the name as follows:

1. **Code-registered skills** (`HarnessConfig.skills`) take precedence. Match by exact `name`.
2. **Workspace-discovered skills** are checked next. The harness scans the session's workspace (if any) for `.claude/skills/<name>/SKILL.md` and loads the first match.
3. If neither resolves, `useSkill` throws `HarnessSkillNotFoundError`.

This precedence rule means a deployment can override a workspace skill by registering one of the same name in code — useful for hotfixes, testing, or pinning a specific version when the workspace's skill is in flux.

**Workspace discovery.**

- Discovery runs on first `useSkill` or `session.listSkills()` call per session, and is cached for the session's lifetime by default. Files added, removed, or edited in the workspace after that point are not visible until the cache is dropped.
- The in-session refresh path is `await session.refreshSkills()`. It clears the cached scan; the next `listSkills` / `getSkill` / `useSkill` call re-runs workspace discovery. Code-registered skills are not affected — they're held on the harness, not on the session, and never go stale. A TUI exposing a "reload skills" command should call this; long-running server sessions can call it on a workspace-mutation hook (e.g. after a `git pull` in a `shared` workspace, or when a file watcher reports a change under `.claude/skills/`).
- `refreshSkills` is local-only. Workspace discovery requires server-side filesystem access, so the method is absent from `RemoteSession` (§13.5). A remote client that wants the same effect should ask the server for it through a product-specific route, or close and re-open the session.
- The skill file format mirrors Anthropic's skill spec: a YAML frontmatter block with `name` + `description`, followed by a Markdown body containing the instructions.
- Files outside `.claude/skills/<name>/SKILL.md` are ignored. There is no recursion into subdirectories beyond `<name>/`.
- If the session has no workspace, only code-registered skills are available.

**Args injection.** When a skill is invoked with `args`, the harness builds the prompt by appending a JSON code block to the skill's `instructions` body (no special delimiters). Skill authors should reference the args naturally in their Markdown — e.g. *"Use the values in the JSON block below to..."*.

**Inspection — two surfaces with different scopes.**

- **Harness surface** — registry view of code-registered skills only. Useful for "what does this product/deployment ship?" (e.g. surfacing built-ins in marketing, build-time validation, dashboards). Says nothing about what any specific session can actually run.
  - `harness.listSkills(): HarnessSkill[]`
  - `harness.getSkill(name: string): HarnessSkill | undefined`
- **Session surface** — full resolution view (code-registered ∪ workspace-discovered, with code wins on name collision). This is the "what can this session actually invoke?" answer, and matches what `useSkill` will resolve.
  - `session.listSkills(): HarnessSkill[]`
  - `session.getSkill(name: string): HarnessSkill | undefined`

In a single-user TUI with a `shared` workspace, harness and session views differ only by the workspace skills. In a multi-tenant deployment with `per-resource` or `per-session` workspaces, the harness view stays constant across sessions while session views differ — exactly the point of session-scoping.

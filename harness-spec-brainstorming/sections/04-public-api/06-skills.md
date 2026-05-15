### 4.6 Skills

A **skill** is a named, parameterised prompt invoked via
`session.skills.use(ref, opts)`.

**Skills are session-scoped in v1.** A skill is "available" only when a
specific session can resolve its `ref` against the static
`HarnessConfig.skills` registry or the session workspace's configured core
`WorkspaceSkills` source/resolver (§2.7). Code-registered skills are about what
the deployment always offers. Workspace skills are about what the current
project offers (e.g. a repo shipping `lint-and-format` or `e2e-tests-studio`
checked into source control). A common filesystem deployment convention is
`.claude/skills/<name>/SKILL.md`, but the configured workspace owns the actual
paths, source, and discovery mechanics. Whether two sessions share the same
workspace skill set depends on the workspace ownership model (§2.7): a
`shared` workspace gives every session the same workspace skills; a
`per-resource` workspace partitions them by tenant; a `per-session` workspace
gives each session its own.

A session is the thing that has both a harness identity and a workspace
identity, so a session is where the workspace skill source is reachable. The
harness has no "execute a skill" method — there's no session for it to execute
against. `session.skills.use(ref)` is the only public caller-facing invocation
surface. Model-facing skill activation through agent tools is
implementation/compatibility material (§11), and when a v1 session exposes that
path for activation it must resolve from the same code + workspace catalog
rather than an alternate view. The harness has no `harness.skills` surface and
no separate per-deployment skill list; the session surface is the public
inspection and invocation boundary.

```ts
interface HarnessSkill {
  name: string; // Lookup key for `use`
  description: string; // Shown in tool catalogues / UIs
  instructions: string; // The prompt body. May reference args.
  category?: string; // Optional grouping label
  filePath?: string; // Optional path-like locator when
  //   the workspace source exposes one.
  metadata?: Record<string, unknown>; // Static or workspace metadata
  //   (e.g. `goal` flag, custom keys).
}

interface UseSkillOptions {
  args?: Record<string, unknown>; // Validated against the resolved
  //   skill's declared args schema.
  modelOverride?: string; // Per-turn model override.
  // Admission idempotency lands in a follow-up slice (§5.2).
}
```

Code-registered skills are supplied directly in this descriptor shape. Their
`metadata` values must contain only primitives, arrays, and plain objects so
returned descriptors cannot share mutable class instances with the original
deployment config.
Workspace-discovered skills are projected into this descriptor shape. Current
core `Skill.source` values such as local, external, or managed content all
project into the same `HarnessSkill` — v1 does not expose a source discriminator
on the session inspection surface. Workspace-only `references`, `scripts`,
`assets`, license, and compatibility remain owned by the `WorkspaceSkills`
source/resolver; frontmatter metadata is passed through on the projection so
callers can filter by author-defined flags (e.g. `metadata.goal === true`).

**Resolution.** When `session.skills.use('triage')` is called, the harness first
checks the code-registered `HarnessConfig.skills` registry by `name`. If a code
skill matches, it wins and the workspace is not consulted. Otherwise the harness
delegates to the resolved session workspace's configured core `WorkspaceSkills`
surface. Workspace `ref` values may be a frontmatter `name:` value or a
workspace-relative path under the configured skills source — core Workspace
owns source, path, glob, duplicate-name, and provider-specific discovery
semantics. If a workspace lookup resolves to a skill whose `name` is already
owned by a code-registered skill, the workspace skill is treated as shadowed and
does not execute. If the ref does not resolve, `use` throws
`HarnessSkillNotFoundError` with `searchedSources` containing the catalogues
that were available for lookup.

**Workspace discovery.**

- Discovery runs asynchronously on the first `session.skills.use`,
  `session.skills.get`, or `session.skills.list` call per in-memory session
  instance that needs the workspace catalog. Code-registered `get` / `use`
  matches can resolve without materializing the workspace. Once workspace
  discovery runs, the discovered catalog is cached for that instance's lifetime
  by default. Files added, removed, or edited in the workspace after that point
  are not visible until the cache is dropped. Concurrent calls during a
  generation build must coalesce on a single-flight shared promise covering
  workspace readiness and workspace skill discovery.
- Workspace resolution, provider mismatch, resume, loss, or discovery failures
  surface through the relevant workspace error boundary from §2.7 rather than
  degrading to an empty catalog.
- The in-session refresh path is `await session.skills.refresh()`. It clears
  the cached workspace-discovery generation; the next `list` / `get` / `use` call
  re-runs workspace discovery through the configured workspace skill source. A
  TUI exposing a "reload skills" command should call this; long-running server
  sessions can call it on a workspace-mutation hook (e.g. after a `git pull` in a
  `shared` workspace, or when the configured skill source reports a change).
- `refresh` is local-only. Workspace discovery requires server-side access to
  the configured workspace skill source/resolver, so the method is absent from
  `RemoteSession` (§13.5). It invalidates the cache generation; an older
  in-flight discovery result must not repopulate the cache after refresh. A
  remote client that wants the same effect should ask the server for it through a
  product-specific route, or close and re-open the session.
- When the configured workspace skill source uses filesystem-style `SKILL.md`
  files, the file format mirrors Anthropic's skill spec: a YAML frontmatter block
  with `name` + `description`, followed by a Markdown body containing the
  instructions.
- Discovery mechanics such as paths, globs, recursion, duplicate-name
  tie-breaking, staleness checks, and custom sources are owned by the configured
  core `WorkspaceSkills` source/resolver (§2.7), not by a Harness scanner.
- If the session has no workspace, only code-registered skills are available.
  A non-matching `use` call throws `HarnessSkillNotFoundError`.

**Args validation.** When the resolved skill declares `metadata.args`, the
harness validates the schema shape and supplied `opts.args` before dispatch.
The current supported schema fields are `required`, `properties`, `type`,
`enum`, `items`, and boolean `additionalProperties`. Unsupported or malformed
schema shapes, missing required keys, type/enum/property failures, non-object
`opts.args`, non-JSON-serializable args, and non-JSON-serializable enum schema
values throw `HarnessSkillArgsValidationError` before any turn starts.

**Args injection.** When a skill is invoked with `args`, the harness builds the
prompt by appending a JSON code block to the skill's `instructions` body (no
special delimiters). Skill authors should reference the args naturally in their
Markdown — e.g. _"Use the values in the JSON block below to..."_. When `args`
is absent or empty, no JSON block is appended.

**Model-facing compatibility.** The v1 `use(...)` operation resolves the skill,
validates declared args schema and supplied args, injects args, then delegates to the
signal-driven `message(...)` path. It does not depend on the model calling a
skill tool. Existing model-facing skill tools and processors may be kept as
compatibility surfaces, but activation/catalog behavior that claims to
represent the session's available skills must use the same resolution chain as
`session.skills.list` / `session.skills.get` / `session.skills.use`. Workspace
file-oriented helpers such as skill search across workspace content or reading
`references/`, `scripts/`, and `assets` remain workspace-only.

**Inspection — session surface only.**

- **Session surface** — discovery view of code + workspace-resolved skills. This is
  the "what can this session actually invoke?" answer, and matches what `use`
  will resolve. The first two methods are async because workspace discovery
  requires I/O against the configured skill source.
  - `session.skills.list(): Promise<HarnessSkill[]>`
  - `session.skills.get(name: string): Promise<HarnessSkill | undefined>`
  - `session.skills.refresh(): Promise<void>` — drops the cached discovery
    generation.
  - `session.skills.use(ref: string, opts?: UseSkillOptions): Promise<AgentResult>`
    — programmatic execution; see resolution and args sections above.

In a single-user TUI with a `shared` workspace, every session sees the same
catalog. In a multi-tenant deployment with `per-resource` or `per-session`
workspaces, session views differ — exactly the point of session-scoping.

**Tool-facing invocation.** Built-in and custom tools can invoke a skill from
inside an active turn via `ctx.useSkill(ref, opts)` on the request context
(§6). It is a shorthand for `session.skills.use(ref, opts)` against the owning
session and obeys the same resolution and validation contract.

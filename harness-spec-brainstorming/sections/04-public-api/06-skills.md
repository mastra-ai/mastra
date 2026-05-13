### 4.6 Skills

A **skill** is a named, parameterised prompt invoked via
`session.useSkill(name, opts)`.

**Skills are session-scoped.** A skill is "available" only when a specific
session can resolve its name. Two sources feed that resolution:

- **Code-registered skills** (`HarnessConfig.skills`) — static, deployment-wide,
the same for every session under this harness. These are about what your
*product* offers (e.g. MastraCode shipping `summarize-pr`, or Devin shipping
`clone-and-explore`).
- **Workspace skills** — resolved from the session workspace's configured core
`WorkspaceSkills` source/resolver (§2.7). These are about what your *project*
offers (e.g. a repo shipping `lint-and-format` or `e2e-tests-studio` checked
into source control). A common filesystem deployment convention is
`.claude/skills/<name>/SKILL.md`, but the configured workspace owns the actual
paths, source, and discovery mechanics. Whether two sessions share the same set
depends on the workspace ownership model (§2.7): a `shared` workspace gives
every session the same workspace skills; a `per-resource` workspace partitions
them by tenant; a `per-session` workspace gives each session its own.

A session is the thing that has both a harness identity and a workspace
identity, so a session is where the two sources meet. The harness has no
"execute a skill" method — there's no session for it to execute against.
`session.useSkill(name)` is the only public caller-facing invocation surface.
Model-facing skill activation through agent tools is
implementation/compatibility material (§11), and when a v1 session exposes that
path for activation it must resolve from the same code-registered-plus-workspace
catalog rather than a workspace-only view.

```ts
interface HarnessSkill {
  name: string;                                // Lookup key for `useSkill`
  description: string;                         // Shown in tool catalogues / UIs
  instructions: string;                        // The prompt body. May reference args.
  argsSchema?: PublicSchema;                   // Optional validation for `useSkill({ args })`
  outputSchema?: PublicSchema;                 // Optional default output schema. The
                                               //   per-call `output` option still wins.
  defaultMode?: string;                        // Optional mode override applied for the call.
                                               //   Lower precedence than per-call `opts.mode`;
                                               //   selects that mode's bound agent for the run.
  source: 'config' | 'workspace';              // Origin (set by the harness, not the author)
  filePath?: string;                           // Optional path-like locator when
                                               //   the workspace source exposes one.
}
```

`argsSchema` and `outputSchema` are local schema objects (`PublicSchema`, §4.8).
Remote skill reads return the wire descriptor shape from §13.3, with schema
fields serialized to JSON Schema Draft 2020-12 descriptors or omitted only when
the local skill has no schema.

Workspace-discovered skills are projected into this descriptor shape. Current
core `Skill.source` values such as local, external, or managed content all map
to `source: 'workspace'`; they do not become additional public source enum
members. Workspace skills omit `argsSchema`, `outputSchema`, and `defaultMode`
unless the configured workspace skill source supplies equivalent metadata.
Current workspace-only `references`, `scripts`, `assets`, license,
compatibility, and arbitrary frontmatter metadata remain owned by the
`WorkspaceSkills` source/resolver. Harness descriptors may keep a path-like
`filePath` locator for operator/debug use, but `HarnessSkill`,
`RemoteSafeSkillDescriptor`, and `WireHarnessSkillDescriptor` do not grow a
second workspace skill metadata contract.

**Resolution.** When `session.useSkill('triage')` is called, the harness
resolves the name as follows:

1. **Code-registered skills** (`HarnessConfig.skills`) take precedence. Match by
exact `name`.
2. **Workspace-discovered skills** are checked next. The harness delegates to
the resolved session workspace's configured core `WorkspaceSkills` surface. Core
Workspace owns source, path, glob, duplicate-name, and provider-specific
discovery semantics.
3. If neither resolves, `useSkill` throws `HarnessSkillNotFoundError`.

This precedence rule means a deployment can override a workspace skill by
registering one of the same name in code — useful for hotfixes, testing, or
pinning a specific version when the workspace's skill is in flux.

**Workspace discovery.**

- Discovery runs asynchronously on the first `useSkill`,
`session.getSkill(...)`, or `session.listSkills()` call per in-memory session
instance, and final catalog generations are cached for that instance's lifetime
by default. Files added, removed, or edited in the workspace after that point
are not visible until the cache is dropped. Concurrent `listSkills`, `getSkill`,
and `useSkill` calls during a generation build must coalesce on a single-flight
shared promise covering workspace readiness, workspace skill discovery, and the
merge with code-registered skills.
- A cached generation is either **code-only** or **workspace-aware**. A
code-only generation is final only when the session has no configured workspace
or the resolved workspace has no configured workspace skill source. If a
workspace is configured but not yet materialised or resumed under lazy
provisioning, a code-only inspection result is provisional: it may satisfy a
`listSkills` / `getSkill` read without forcing sandbox or browser startup, but
it must not populate the final session cache, must not block the next skill read
from retrying workspace discovery, and must not justify a final
`HarnessSkillNotFoundError` from `useSkill`.
- Before `useSkill` reports that a non-code-registered skill is absent, the
harness must build a final workspace-aware generation when a workspace skill
source may exist for that session. Implementations may use a provider's
non-materialising skill source when one is available; otherwise they may
materialise or resume the workspace and then delegate to the current core
`WorkspaceSkills` surface. Workspace resolution, provider mismatch, resume,
loss, or discovery failures do not degrade to a cached code-only catalog; they
surface through the relevant workspace error boundary from §2.7.
- The in-session refresh path is `await session.refreshSkills()`. It clears the
cached workspace-discovery generation; the next `listSkills` / `getSkill` /
`useSkill` call re-runs workspace discovery through the configured workspace
skill source. Code-registered skills are not affected — they're held on the
harness, not on the session, and never go stale. A TUI exposing a "reload
skills" command should call this; long-running server sessions can call it on a
workspace-mutation hook (e.g. after a `git pull` in a `shared` workspace, or
when the configured skill source reports a change).
- `refreshSkills` is local-only. Workspace discovery requires server-side access
to the configured workspace skill source/resolver, so the method is absent from
`RemoteSession` (§13.5). It invalidates the cache generation; an older in-flight
discovery result must not repopulate the cache after refresh. A remote client
that wants the same effect should ask the server for it through a
product-specific route, or close and re-open the session.
- When the configured workspace skill source uses filesystem-style `SKILL.md`
files, the file format mirrors Anthropic's skill spec: a YAML frontmatter block
with `name` + `description`, followed by a Markdown body containing the
instructions.
- Discovery mechanics such as paths, globs, recursion, duplicate-name
tie-breaking, staleness checks, and custom sources are owned by the configured
core `WorkspaceSkills` source/resolver (§2.7), not by a Harness scanner.
- If the session has no workspace, only code-registered skills are available.

**Args injection.** When a skill is invoked with `args`, the harness builds the
prompt by appending a JSON code block to the skill's `instructions` body (no
special delimiters). Skill authors should reference the args naturally in their
Markdown — e.g. *"Use the values in the JSON block below to..."*.

**Model-facing compatibility.** The v1 `useSkill(...)` operation resolves the
skill, validates local `argsSchema` when present, injects args, then delegates
to
the signal-driven `message(...)` path for untyped calls or the sync-generate
path for typed `output` calls (§4.2, §4.4). It does not depend on the model
calling a skill tool. Existing model-facing skill tools and processors may be
kept as compatibility surfaces, but activation/catalog behavior that claims to
represent the session's available skills must use the same resolution chain as
`session.listSkills()` / `session.getSkill()` / `session.useSkill()`. Workspace
file-oriented helpers such as skill search across workspace content or reading
`references/`, `scripts/`, and `assets` may remain workspace-only because
code-registered skills have no required filesystem layout; those helpers must
fail gracefully or omit code-registered skills rather than implying a split
catalog.

**Inspection — two surfaces with different scopes.**

- **Harness surface** — registry view of code-registered skills only. Useful for
"what does this product/deployment ship?" (e.g. surfacing built-ins in
marketing, build-time validation, dashboards). Says nothing about what any
specific session can actually run.
  - `harness.listSkills(): HarnessSkill[]`
  - `harness.getSkill(name: string): HarnessSkill | undefined`
- **Session surface** — full resolution view (code-registered ∪
workspace-discovered, with code wins on name collision). This is the "what can
this session actually invoke?" answer, and matches what `useSkill` will resolve.
Both methods are async because workspace discovery requires I/O against the
configured skill source.
  - `session.skills.list(): Promise<HarnessSkill[]>`
  - `session.skills.get(name: string): Promise<HarnessSkill | undefined>`
  - `session.skills.refresh(): Promise<void>` — drops the cached discovery
    generation (see below).

In a single-user TUI with a `shared` workspace, harness and session views differ
only by the workspace skills. In a multi-tenant deployment with `per-resource`
or `per-session` workspaces, the harness view stays constant across sessions
while session views differ — exactly the point of session-scoping.

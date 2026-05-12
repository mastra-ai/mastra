## 7. Sandbox command policy

Harness v1 defines an optional workspace/sandbox command-start policy for
deployments that want a runtime-controlled command fence. It is not a Session
permission system, route principal authorization, user-managed grant/rule
surface, or argument-policy DSL. Route/principal authorization (§13.2) and the
owning session's tool permission gate (§4.2) must already have allowed the tool
call before command policy is evaluated. Conversely, session grants, effective
`allow`, or per-run `yolo` never bypass a restricted workspace command policy.

The policy is configured with the workspace/sandbox provider. Harness v1 does
not add public `defineCommand` / `getCommands` APIs, executable command
handlers, or per-command environment overrides to the core `WorkspaceSandbox`
contract. Provider-specific wrappers may implement richer command registries,
but those are outside the v1 portable contract unless a later extension defines
their ownership, rehydration, and foreground/background process hooks.

`SandboxConfig.commandPolicy` and `SandboxConfig.commands` are Harness-level
workspace/sandbox configuration that wraps a core sandbox provider; they do not
require the public core `WorkspaceSandbox` interface to grow registry APIs.

```ts
interface SandboxConfig {
  commandPolicy?: 'open' | 'restricted'; // default 'open'
  commands?: Record<string, CommandDefinition | null>;
}

interface CommandDefinition {
  description?: string;
  // Allows shell-form invocation for this first token after the restricted
  // shell-safety checks below. Default: false.
  shell?: boolean;
}
```

`commands` is a static allowlist for the command-start gate. A `null` entry
explicitly disables a provider/default command name. V1 command definitions do
not carry executable callbacks, per-principal grants, argument validators, or
environment mutation.

Form classification:
- Structured form: `args` is supplied (including empty `[]`). The registry is
  consulted by command name and arguments are passed through as argv; they are
  never reparsed as shell syntax.
- Shell form: `args` is omitted and `command` is the whole command line. Empty
  or whitespace-only input is shell form.
- Compatibility adapters for the current model-facing
  `workspace_execute_command` shape classify its shell-string `command` input
  as shell form before restricted-policy evaluation, even when the underlying
  core compatibility call passes `args = []`. Implementations must not
  reinterpret a legacy shell command string as structured argv solely because of
  that adapter shape.

Current-code migration boundary:
- Restricted command policy may be enforced by a core provider, provider
  adapter, or Harness wrapper, but the resolved workspace path is valid only
  when every command-start entrypoint exposed for that workspace routes through
  the same policy decision before execution. This includes foreground
  `executeCommand` and background `processes.spawn`; a single gate on
  `processes.spawn` is sufficient only when `executeCommand` delegates entirely
  through that gated path. A provider with a custom `executeCommand` and a
  process manager must gate both entrypoints or reject
  `commandPolicy: 'restricted'` at construction time.
- Allowed starts delegate to the existing sandbox/process behavior. The gate is
  not a portable callback dispatcher, alternate executor, command ACL system, or
  process-manager subclass API.
- For policy purposes, a governed command start is the logical command submitted
  to the sandbox command-start path by a model-visible or user-authored
  workspace command tool after tool-level normalization and deterministic
  adapter rewrites that affect the executable or arguments to be started, and
  before provider isolation wrapping, cwd/env assembly, or process-manager
  implementation details. A raw pre-rewrite model command cannot authorize a
  different final logical start.
- Provider-owned internal command starts are outside the portable v1 command
  policy only when they are not model-authored or user-authored shell text, are
  not exposed as v1 command definitions, and run through an explicit
  provider-owned internal path or marker. If an implementation sends such a
  start through the ordinary governed sandbox command-start path without that
  boundary, restricted policy applies to it. Rewriting a user-authored command,
  including browser/CDP argument injection, does not by itself make the command
  internal; the rewritten logical command must either be policy-checked or the
  rewrite must be constrained so it cannot change the command owner, introduce
  shell-control syntax after approval, or start a different command than the one
  authorized.

Resolution rules:
- The same resolution applies before every sandbox command start, including
  foreground `executeCommand` and background process-manager spawn paths. A
  replayed tool call under `'restricted'` fails closed if the configured policy
  and command map cannot be reconstructed; this is part of the runtime
  dependency rehydration boundary in §15.1/§15.2.
- `'open'` policy (default): unregistered commands run normally; shell form
  skips the registry; `shell: true` has no effect under `'open'`.
- `'restricted'` policy:
  - Structured form for an unregistered command returns `{ exitCode: 127 }`.
  - Shell form is refused with `{ exitCode: 127 }` and a stable
    policy-refusal marker on `stderr` unless the first whitespace-delimited
    token of the input names a configured command whose `shell` is `true`.
    Empty or whitespace-only input is refused.
  - Even when the first token names a `shell: true` owner, shell form is
    refused with `{ exitCode: 127 }` if the command line contains any of
    `|`, `&`, `;`, `>`, `<`, backtick, `$(`, `(`, a leading `KEY=VALUE`
    assignment, or a newline outside quotes. Compound or substituted commands
    must be expressed as multiple structured-form calls or handled by a
    product/provider-specific wrapper outside the portable v1 command policy.
  - Authorized shell form continues through the sandbox provider's ordinary
    command-start path after policy checks. Harness v1 does not define a
    portable callback dispatch surface for shell owners.
  - A shell-string-only provider/process path without a shared interposition
    point is valid only under `'open'`. Configuring `'restricted'` against a
    sandbox/provider path that cannot interpose on both foreground
    `executeCommand` and background process manager spawns is rejected at
    sandbox construction time, not silently 127-ed at every call.
  - Subagents that inherit the parent workspace inherit its policy. Subagents
    provisioned with a fresh workspace (see §2.7, §8) use the policy
    configured for that workspace.

---

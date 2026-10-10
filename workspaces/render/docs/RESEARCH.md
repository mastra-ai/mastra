# Render Workspace sandbox decision

Research gate recorded on October 9, 2026; updated during the production coverage expansion. This is local engineering evidence, not a published integration or a launch commitment.

## Outcome and scope

A Mastra developer whose agent needs isolated code execution can select Render, run a real code-repair task, inspect files and test results, and release the environment. Completion requires full public SDK capability coverage, deterministic tests, actual snapshot restoration and transfers, a real model using Mastra tools against Render, independent result verification, and confirmed resource cleanup. Publishing, upstream PR edits, workflow services, provider comparisons based on untested claims, and changes to Mastra core are excluded.

Dedupe: inspected the existing `mastra` checkout, `workflows/render`, `mastra-render-review`, `render-sandbox-integrations`, and private CareerOS Initiatives & Bets. This is a new sandbox provider inside the existing Mastra contribution, not another repository or workflow engine. Code belongs in `workspaces/render`; private operating state stays in the existing [Initiatives & Bets](https://app.notion.com/p/39f751b48326810fb988f4268a0b047d).

## Versions and sources

- Mastra checkout: `14613e73a5`, core 1.74.0. `npm view` reports public core 1.75.0. Existing Workflows pins core 1.67.0. Verify both public versions rather than assuming the checkout and release are identical.
- Render SDK: public 1.2.0, MIT; local source `github-repos/sdk`, `a3cb7b7`. Sandboxes is public but experimental: `new Render(options).experimental.sandboxes`.
- Render backend inspected read-only: `github-repos/api`, `039d78ab5221932f3bc628941e0e0aab9ffc8409`. Backend source explains behavior and is never an integration dependency.
- Official [Mastra sandbox entry](https://mastra.ai/docs/sandbox/overview), [Render sandbox overview](https://render.com/docs/sandboxes), and [TypeScript API](https://render.com/docs/sandboxes-sdk-typescript), retrieved October 9.
- Current docs conflict with SDK source on default sandbox lifetime (24 hours versus 7200 seconds). Avoid relying on either default: send an explicit 900-second maximum lifetime and verify creation output.

These are implementation sources and vendor specifications, not independent evidence of provider superiority. Live results will establish only the tested task and account behavior.

## Mastra agent and lifecycle path

Read `packages/core/AGENTS.md`, `packages/core/src/agent/agent.ts`, `workspace/workspace.ts`, `workspace/lifecycle.ts`, sandbox interfaces/base class/types, built-in tools and tests, and existing workspace providers.

1. `Agent.generate` resolves its configured Workspace (static or callback) through `getWorkspace`; an agent workspace takes precedence over the global Mastra workspace.
2. Workspace contributes instructions and generated tools based on capabilities. `executeCommand` enables the shell tool; `processes` enables background process tools. A separate `WorkspaceFilesystem` is needed for native read/write/list filesystem tools.
3. `Workspace.init()` initializes a static filesystem and starts a static sandbox via `callLifecycle`. Resolvers return request-scoped providers; their lifecycle remains the caller's responsibility. Static providers are shared across requests, so the example creates one workspace per task.
4. The shell tool resolves the sandbox at invocation, converts its timeout seconds to milliseconds, and forwards cwd, output callbacks, and the agent abort signal to `executeCommand`. It formats stdout/stderr and nonzero status for the model. Nonzero process exits are results, not transport exceptions.
5. `MastraSandbox` offers logger integration, start coalescing, acquisition hooks and lifecycle wrappers. Implementing `WorkspaceSandbox` directly is also an explicitly supported public extension. The provider will use that interface so ownership, concurrent direct calls, and late create responses have a single explicit lifecycle implementation.
6. Agent turn completion does not mean sandbox termination. `Workspace.destroy()` explicitly destroys the static sandbox. The example owns its workspace and calls destroy in `finally`; failed initialization is also cleaned up. `Workspace.stop()` and Mastra shutdown call provider stop. Render has no SDK pause operation, so stop must be documented as destructive for owned environments.

The public interface supports the provider. A separate generic core cancellation-reporting defect was later reproduced and filed as issue #26580; see the current-main follow-up below.

## Existing providers and discovery

All are under `workspaces/`, with public exports, SDK dependencies, core peer dependencies, and colocated tests. Their integrations live under `docs/src/content/en/integrations/sandboxes` and are listed by the integration catalog/sidebar. The generic sandbox overview embeds the sandbox integration grid.

| Provider inspected | Configuration/lifecycle convention                                                                                            | Commands, files, tests                                                                                                         |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| E2B                | `MastraSandbox`, find/connect/create, templates, API key, pause on stop and kill on destroy                                   | SDK process manager, native bulk write, mounts, code-mode transport; unit and integration tests                                |
| Modal              | App/image/credentials, explicit create/reconnect, snapshot before stop                                                        | SDK process manager and snapshot-oriented recovery; colocated unit/live suites                                                 |
| Daytona            | SDK credentials, create/connect, lifecycle and mount state                                                                    | Process manager, mount-aware shell, file operations; provider-specific retries must not be copied into Render command dispatch |
| Vercel MicroVM     | SDK token/team/project; stop preserves filesystem snapshots; named sandboxes restore on next start; destroy deletes snapshots | Process manager, native bulk write and exposed ports; serverless provider is a separate, narrower implementation               |
| Railway            | ID/checkpoint/config, stop captures checkpoint before destruction                                                             | Process manager, idle timeout and snapshot reconstruction; lifecycle and concurrent-use tests                                  |
| Cloudflare/Docker  | Provider-specific container/runtime configuration                                                                             | Additional examples of thin Workspace capability adapters and native file upload                                               |

These are source observations, not a live comparison of providers. Reuse package placement, public imports, capability-driven tools, explicit lifecycle docs, deterministic SDK fakes and opt-in live checks. Do not copy pause/resume, networking, mount, automatic replay, or process-kill promises unsupported by Render.

The feature follow-up rechecked official main, still `918704fd4608aa4d9d90d4d92c0a3429de2b880a`. Peer adapters cover several gaps, but they do not all expose their entire vendor SDK:

- State persistence differs by provider: [Railway](https://github.com/mastra-ai/mastra/blob/918704fd4608aa4d9d90d4d92c0a3429de2b880a/workspaces/railway/src/sandbox/index.ts#L358-L431) implements named checkpoint capture/restore; [E2B](https://github.com/mastra-ai/mastra/blob/918704fd4608aa4d9d90d4d92c0a3429de2b880a/workspaces/e2b/src/sandbox/index.ts#L500-L535) pauses/resumes VM state; [Modal](https://github.com/mastra-ai/mastra/blob/918704fd4608aa4d9d90d4d92c0a3429de2b880a/workspaces/modal/src/sandbox/index.ts#L230-L263) attempts a filesystem snapshot on stop and retains it in the provider instance for restart; [Vercel MicroVM](https://github.com/mastra-ai/mastra/blob/918704fd4608aa4d9d90d4d92c0a3429de2b880a/workspaces/vercel/src/microvm/index.ts#L265-L305) preserves filesystem state on stop and restores named sandboxes. These are source-verified capabilities, not live persistence tests from this task. They are not identical guarantees or universal snapshot CRUD wrappers.
- E2B, Daytona, Docker and Vercel MicroVM have process managers for multiple background processes, with concurrent execution; the initial Render adapter's BUSY guard has since been removed. Independent command termination that preserves the sandbox was already live-verified for Daytona and Docker. Modal has a process-manager interface but failed our live cancellation test; API presence is not proof of correct termination.
- E2B, Daytona and Vercel MicroVM implement native bulk writeFiles. Docker builds and uploads a tar stream internally. Their shared Mastra writeFiles input is still in-memory file contents; this is not a general caller-provided stream or archive upload interface. Inspected native bulk-write implementations do not impose the initial Render adapter's 16 MiB per-file ceiling (since removed), but no equal-limit large-file benchmark was run and service limits remain provider-specific.
- Full vendor resource management is not a standard WorkspaceSandbox capability. [E2B](https://github.com/mastra-ai/mastra/blob/918704fd4608aa4d9d90d4d92c0a3429de2b880a/workspaces/e2b/src/sandbox/index.ts#L314-L340), [Daytona](https://github.com/mastra-ai/mastra/blob/918704fd4608aa4d9d90d4d92c0a3429de2b880a/workspaces/daytona/src/sandbox/index.ts#L413-L438) and Vercel MicroVM expose their underlying SDK sandbox objects for operations outside the abstraction. The Render adapter now exposes the same public client through `sdk` as well as typed management methods.

## Different meanings of sandbox

- **Workspace sandbox:** the chosen path. An agent gets shell tools that run in the isolated environment. Shell commands can read, write, list, and test files in that environment.
- **`createTool`:** can call this provider directly, but a bespoke execute-code tool would hide the established Workspace discovery and lifecycle path. Not needed for the first run.
- **Code mode:** its default transport requires `sandbox.processes.spawn` and bidirectional stdin/stdout JSON-RPC. Render SDK 1.2.0 exposes completed exec output streaming, not that process interface. This provider does not claim code-mode transport support.
- **SandboxDeployer:** bundles and serves a Mastra application inside a sandbox and needs deployment/network capabilities. It is a distinct use case and is not implemented here.

## Existing Render Workflows integration

`workflows/render/package.json` names private `@renderinc/mastra` 0.0.0 and pins `@renderinc/sdk` 1.2.0, core 1.67.0 and Zod 3.25.76. Its `transport.ts` lazily constructs `new Render(options)`; the SDK owns token/environment fallback. Workflows also needs task registration, transport, persistence, worker and runtime modules, and workflow-specific errors/fixtures.

GitHub read check: [PR 25515](https://github.com/mastra-ai/mastra/pull/25515) is OPEN with no merge date. Earlier PR 25352 is superseded. The package remains provisional, private and unmerged, not an assumed public prerequisite.

Share SDK 1.2.0 and the exact `ConstructorParameters<typeof Render>[0]` configuration convention (`token`, `ownerId`, `region`, SDK environment fallbacks). Allow injecting a Render client so callers can share one instance. No shared utility is necessary because the SDK already owns these few configuration rules. Sandboxes imports neither Workflows integration code nor `@renderinc/sdk/workflows`; it needs no workflow service.

## Public Render API map

| Operation        | Public SDK 1.2.0                                                            | Behavior and chosen treatment                                                                                                                                                                                                                            |
| ---------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create           | `sandboxes.create(input)`                                                   | Returns while creating. Explicit lifetime and network policy. No create idempotency key or request AbortSignal; never retry automatically. Late responses must retain the ID and attempt cleanup. Unknown acceptance remains bounded by server lifetime. |
| Attach/readiness | `sandboxes.get(id, ownerId)`                                                | Poll creating to running under a deadline. Authentication, missing ID and terminal states stop the wait. Attachment never grants ownership.                                                                                                              |
| Execute          | `sandboxes.exec(id, command, ownerId, signal)`                              | Fresh `bash -c`; output events identify stdout/stderr, exit event carries final status. SDK rejects malformed/interrupted/error streams. No native argv, cwd or per-command kill/timeout. Quote argv and cwd in a command wrapper. No automatic retry.   |
| Upload           | `sandboxes.upload(id, path, bytes, ownerId, {signal})`                      | Bytes, Node streams, tar and gzip archive inputs. Parent creation and optional chmod use exec. Configurable size limits; gzip is streamed through host decompression because the live endpoint rejects its advertised media type.                        |
| Download         | `sandboxes.download(id, path, ownerId, signal)`                             | SDK buffers the full file. Returns bytes, size and content type; optional file-size checks cannot promise a streaming memory cap against concurrent writers.                                                                                             |
| Other files      | `sandboxes.exec(...)`                                                       | Shell implements read/list/stat/exists/copy/move/remove when the agent needs them. Do not pretend this implements `WorkspaceFilesystem` or atomic optimistic-write semantics.                                                                            |
| Cleanup          | `sandboxes.terminate(id, ownerId)` and `list({status:['terminated', ...]})` | Termination is an explicit API action. Confirm status/termination timestamp independently through the public SDK. Keep IDs when cleanup fails.                                                                                                           |
| Snapshots        | `sandboxes.snapshots.*`, create input snapshot ID/name                      | Full create/get/list/delete, wait-until-available, filesystem/runtime restore, named Mastra snapshot hook and checkpoint/seed clone fallback. No native pause/resume.                                                                                    |

Backend `pkg/sandboxexec/handler.go:169` explicitly uses `context.WithoutCancel(r.Context())`; a disconnected stream keeps its command running. This confirms the cleanup design independently of documentation. Backend public contract also exposes file-list and execution-history/update surfaces in generated REST definitions. The high-level TypeScript sandbox client does not expose all of these; update-execution is completion reporting, not a public process kill API. Do not call backend internals or invent SDK methods.

Credentials stay on the host. Only the explicit create `env` and per-command `env` enter the sandbox. Never spread `process.env`. Network policy is an explicit deny-all default in the example; installation over the network requires a deliberate allow policy. Each exec starts a fresh shell: files persist for the sandbox lifetime, shell cwd and exports do not carry over to the next exec. Verify these properties live.

## Complete public SDK coverage

The production requirement is to expose every capability available in SDK 1.2.0. The earlier scope omitted supported functionality and is superseded by this implementation:

| SDK capability                                                      | Implemented integration surface                                               |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Full creation options and attachment                                | `create`, `start`, `sandboxId`, public client configuration                   |
| Native event streaming and controlled commands                      | `exec`, `executeCommand`, callbacks and actual final status                   |
| Bytes, Node streams, local files, tar directories and gzip archives | `upload`, `uploadFile`, `uploadDirectory`, `writeFiles`                       |
| Download response metadata and local destination                    | `download`, `readFile`, `downloadToFile`                                      |
| Filesystem/runtime snapshot CRUD and restoration                    | `snapshots.*`, `captureSnapshot`, `restore`, `create.snapshotId/snapshotName` |
| Mastra checkpoints                                                  | `supportsCheckpoints`, `snapshot`, `clone` with checkpoint/seed/base fallback |
| Filtered/paginated sandbox and group queries                        | `listSandboxes`, `listGroups`, `refresh`, cached `getInfo`                    |
| Explicit lifecycle control and full client access                   | `stop`, `destroy`, `terminate`, `sdk`                                         |

Native methods for interactive stdin, public preview URLs, FUSE mounts and computer use do not exist on this SDK client. `WorkspaceFilesystem`, a background process manager and code-mode transport are separate Mastra capabilities and are not advertised. Native per-command kill is absent, but adapter-managed command control is implemented using public exec.

## Ownership, cancellation and bounds

Independent operations run concurrently. Shared provisioning coalesces while each caller may cancel its own wait. Default command control uses a Python supervisor that owns a shell process group, authenticates a separate control request, retains the group leader's identity until signaling is finished, and verifies group termination. It preserves the sandbox and unrelated commands. Deliberately detached descendants are outside that guarantee.

Explicit `terminate` mode disposes an owned resource on interruption. `observe` mode and native `exec` only stop observation, preserving the provider for reuse. Attached `destroy` detaches, while explicit `terminate()` authorizes resource termination. Failed kill confirmation remains an error with remote uncertainty; the shared Mastra issue still matters on this path.

File transfers no longer have the initial 16 MiB hard ceiling. An optional application limit remains available. Download buffering is inherited from the SDK. Uploads may be partial on failure. The live archive check found that SDK 1.2.0 advertises `application/gzip` while the service returns `unsupported_media_type`; streaming host decompression followed by tar upload supplies gzip extraction without a full archive buffer.

Creation and control-plane calls lack native signal cancellation and creation idempotency. Bound caller waits, retain late sandbox and snapshot receipts, and never retry uncertain provisioning. Snapshots are independent durable resources, deleted explicitly or by expiry. The finite sandbox lifetime is a backstop, not cleanup confirmation.

## User task and discovery

The representative first run repairs a CSV total program, reads input/test files in the sandbox, runs protected tests, writes a JSON report, and returns `total=42, row_count=3`. A host verifier restores original tests/input and re-runs them, downloads the report and corrected source, then confirms sandbox termination. This reuses the already reviewed sandbox guide fixture to reduce unrelated variation.

Entry: developer searches for isolated execution in Mastra, opens Docs > Sandboxes and filesystems, follows the remote sandbox grid, selects Render, then follows the installation/configuration and Workspace agent example. Prepare the catalog entry, integration sidebar/page and example as a local reviewable patch. The package remains unpublished pending Mastra review and release. Do not give a nonexistent npm or clone destination as a working command.

Upstream placement starts **LOCAL**. A local page does not establish upstream discoverability.

## Slack decisions, suggestions and stale statements

- [Mastra maintainer discussion and all replies](https://renderinc.slack.com/archives/C0ABT0DS0KG/p1790615655565939): permission to submit Workflows work, engineering review required, and September 29 handoff to PR 25515. This is not acceptance of a sandbox provider or authorization to edit the upstream PR.
- [September 10 sandbox friction](https://renderinc.slack.com/archives/C09ACTYAN0Y/p1789072785979109): argv, cwd, per-command timeouts, filesystem helpers, session recovery and clear process model are proposed improvements. Treat them as gaps to verify against SDK 1.2.0, not shipped promises.
- [October 2025 platform hypothesis and replies](https://renderinc.slack.com/archives/C09ACTYAN0Y/p1761095792576169): Mastra mentioned as a possible framework integration; replies favor early users plus a broader end-to-end offering. Historical direction, not a current release requirement.
- [August alpha scope](https://renderinc.slack.com/archives/C09ACTYAN0Y/p1786750133526459): says snapshots/allowlists come later. Current SDK contains snapshots and network rules, so this is outdated capability evidence.
- Current private launch view tracks existing runtime/plugin work separately from Workflows review. Add only a pointer/state update to that view, not a competing tracker or unapproved team-facing entry.

## Architecture decision

The initial prototype used private `@renderinc/mastra-sandbox`. The user clarified maintenance responsibility on October 9: Render maintains an integration inside Mastra. The current candidate is `@mastra/render` in `workspaces/render`, using Mastra workspace dependencies, CI and Changesets, with SDK 1.2.0 pinned. It exposes `RenderSandbox` implementing public `WorkspaceSandbox`, plus a serializable editor provider descriptor if the tested public core exports support it. Use shell-backed agent file work, complete SDK transfer/resource/snapshot APIs, and confirmed command control. Test against public core 1.75.0 and 1.67.0, with the existing Workflows package present and absent. No core change. Record implementation tests and fresh live observations separately in `validation/`.

## Current-main follow-up, October 9

The initial source inspection used the October 1 fork. The follow-up built official main `918704fd4608aa4d9d90d4d92c0a3429de2b880a` and ran the actual agent and adapter tests against it. Public interfaces still fit. Testing exposed a generic command-tool cancellation-reporting gap: aborting observation is described as killing remote work. Published core 1.75.0 is also affected; 1.67.0 passes the reproduction. See [UPSTREAM.md](UPSTREAM.md) for the public-API reproduction, the live proof and the proposed neutral wording fix. This supersedes the initial conclusion that no core proposal was needed for truthful tool-level reporting.

## Process-control feasibility correction after live provider comparison

The initial design conservatively omitted individual-command termination because SDK 1.2.0 has no dedicated kill-exec method. Docker source comparison shows that a native endpoint is not necessary for an adapter-managed approach: its provider uses a shell process group and a second exec to signal and verify the group. Daytona uses a dedicated session and deletes that session. The initial Render adapter had neither layer. The expanded implementation adds supervisor-based command control.

A subsequent live Render prototype passed normal completion, abort and timeout using public SDK exec and public Mastra WorkspaceSandbox tools on unpatched core 1.75.0. Parent and ordinary child processes stopped, delayed writes were prevented, unrelated work survived, and the sandbox stayed usable. Cleanup was confirmed. See [feasibility evidence](../validation/render-process-control-probe.json) and [comparison](../validation/RESULTS.md).

This supersedes any inference that the public SDK makes command-level cancellation impossible. The prototype was subsequently integrated and hardened with process identity, startup/exit receipt handling, bounded failed-control reporting, concurrency and documented group-escape limits. Current verification is recorded in validation/RESULTS.md. The separate upstream false-killed reporting defect still matters when termination is unconfirmed.

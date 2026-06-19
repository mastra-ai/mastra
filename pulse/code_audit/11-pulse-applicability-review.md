# Pulse Applicability Review

Scope: `pulse/code_audit/*.md`, focused on whether each candidate belongs in the initial Pulse design.

This is an overlay on the raw audit. The earlier files intentionally captured many possible observability boundaries. This file narrows that list to candidates that can be attributed to a user primitive execution:

- agent
- workflow
- processor
- scorer/eval
- tool
- model call inside a primitive
- memory/state activity owned by one of the above
- channel/harness/A2A activity that sends work into, or receives output from, an agent/workflow

Non-goals for the initial Pulse pass:

- admin/catalog/configuration APIs
- organization or entitlement tasks
- observability navigation/query APIs
- storage adapter internals by themselves
- server/auth/session plumbing by itself
- telemetry about Mastra product usage
- generic logger/cache/bundler/deployer infrastructure

## Verdict Labels

| Label | Meaning |
| --- | --- |
| Apply | Good initial Pulse candidate. It is directly part of a user primitive run or user-visible primitive state. |
| Apply at caller | The underlying helper/storage function is too low-level, but a caller in an agent/workflow/tool/scorer path should emit the Pulse. |
| Defer | Potentially useful later, but not for the first user-primitive Pulse scope. |
| Skip | Do not add Pulse here for now. Admin, org, catalog, observability-query, storage plumbing, or unrelated infrastructure. |

## File-Level Summary

| Audit File | Verdict | Notes |
| --- | --- | --- |
| `01-signal-surfaces.md` | Apply conceptually | Current signal APIs are source material for Pulse shape, but do not instrument every API method as a Pulse. |
| `02-span-call-sites.md` | Apply selectively | Agent/model/tool/workflow/processor/scorer spans map to primitive Pulse candidates. Workspace/admin-ish spans need filtering. |
| `03-log-metric-score-sites.md` | Apply selectively | Structured logs/metrics/scores inside primitive runs apply. Logger infrastructure and log listing do not. |
| `04-propagation-sites.md` | Apply at caller | Context propagation matters for IDs/relationships, but propagation helper calls should not normally emit standalone Pulses. |
| `05-recent-feature-coverage-gaps.md` | Apply selectively | Harness, signals, sandbox during tool/workspace execution, durable runs, channels, long-running agents apply. Trusted actor/admin details mostly defer/skip. |
| `06-file-by-file-pulse-candidates.md` | Apply selectively | Broad inventory. Use this file for discovery, then gate every item by primitive ownership. |
| `07-deeper-core-pulse-candidates.md` | Mixed | Memory/evals/runtime provider resolution mostly apply at caller; server/license/cache/bundler/deployer/editor mostly skip. |
| `08-runtime-surfaces-pulse-candidates.md` | Mostly apply | Tools, task tools, model routing during primitive calls, and websocket streaming apply. Some constructor/build-time items should be caller-only or deferred. |
| `09-storage-observability-pulse-candidates.md` | Mostly skip/apply at caller | Storage and observability query APIs should not emit Pulse directly. Record builders/sinks may be implementation details behind Pulse storage later. |
| `10-protocol-telemetry-adapter-pulse-candidates.md` | Mixed | A2A and ToolLoopAgent runtime apply. Agent Builder, telemetry, generic logging mostly skip/defer. |

## Strong Initial Apply Areas

These candidates directly describe user primitive execution and should stay in the Pulse design space.

| Area | Applies To | Keep From Audit |
| --- | --- | --- |
| Agent run lifecycle | agent | agent run start/output/error, loop iterations, tripwire, stop condition, usage, response shape, stream start/finish. |
| Model calls | agent, workflow, scorer, processor, tool when model-backed | model request, model output, model error, server-side fallback attribution, routing decision when attached to the call. |
| Tool execution | tool inside agent/workflow | tool input validated, approval requested/resolved, execute started/completed/failed, suspend/resume, output validation, tool stream chunks. |
| Workflow execution | workflow | workflow run, step start/output/error, suspend/resume, retry/replay, durable event terminal state. |
| Processor execution | processor | input/output processor start/result/error, state-signal compute when it modifies model context for a run. |
| Scorer/eval execution | scorer/eval | scorer pipeline, eval item execution, score generation, score failure, experiment run/item lifecycle. |
| Memory during agent runs | agent, processor | thread/message reads/writes, working memory updates, semantic recall, OM decisions, but emitted from memory processors or agent run context. |
| Long-running agent streams | agent | until-idle stream lifecycle, continuation, background task event forwarding/dedupe. |
| Durable agent/workflow | agent, workflow | durable stream start/resume/cleanup, suspended tool continuation, durable registry state when tied to one run. |
| Harness and channels | agent-facing adapter | message received/sent-to-agent, response posted, tool suspension display/resume, durable harness session only when it owns an agent run. |
| A2A remote agent | agent/subagent | remote generate/stream/resume, task polling, input-required suspension, request retry/backoff, stream parsing. |
| Code Mode | tool | runner process start/end, RPC call start/end, frame parse failure, code-mode log as tool output. |

## Apply at Caller

These are real Pulse concerns, but the audited location is too generic. Emit from the primitive-level caller instead.

| Raw Audit Area | Caller-Level Pulse |
| --- | --- |
| Storage domain reads/writes for memory, thread-state, workflow snapshots, experiment results | Emit from memory processor, task tool, workflow runtime, eval runner, or agent run that caused the read/write. |
| `getStore(...)`, storage init, filesystem JSON read/write | Do not emit directly. The primitive operation should record `storage_unavailable`, `state_persisted`, or `state_persist_failed` if it affects execution. |
| Observability record builders/sinks | Pulse storage implementation detail. Emit a Pulse before storage; do not make storage insertion itself a user Pulse. |
| Model config resolution helpers | Emit as part of `model_call.started` or `model_call.failed`, not when a reusable model object is constructed outside a run. |
| Request context merging/propagation | Use to attach metadata/relationships. Do not emit unless context validation fails in a primitive call. |
| Tool schema conversion/building | Emit only when it affects a concrete tool call, e.g. validation failure or approval policy decision. |
| Provider/toolkit catalog lookup | Emit only when resolving tools for an agent run; skip catalog browsing/admin listing. |
| Cache operations | Emit only if cache hit/miss materially changes a primitive output, such as response cache or stream replay. |

## Skip for Initial Pulse

These should be explicitly excluded for now.

| Area | Why Skip |
| --- | --- |
| Observability storage query/navigation APIs (`listTraces`, `getStructure`, entity discovery, tag discovery, metric names, percentiles, breakdowns) | These help users navigate observability data. They are not work performed by an agent/workflow/tool/scorer. |
| Observability storage strategy/features (`observabilityStrategy`, `runtimeTracingStrategy`, `getFeatures`) | Backend capability/configuration, not a user primitive event. |
| Observability storage writes as independent events | Pulse may use storage, but a storage write is not itself the user observation. |
| Storage composition/init/domain resolution | Infrastructure boot/plumbing. Skip unless a primitive fails because required storage is unavailable. |
| Filesystem DB and Git history internals | Editor/source-control implementation details, not primitive execution. |
| Editor entities, agent/workspace/skill/prompt-block/scorer-definition CRUD/versioning | Admin/config authoring APIs. Not Pulse scope currently. |
| Agent Builder picker/model policy UI derivation | Admin/UI configuration. Skip for Pulse. Runtime enforcement denial during an agent run can be a primitive error later. |
| Server route registration, auth provider/session/SSO lifecycle, HTTP request logging config | Server/admin plumbing. Skip unless an agent/workflow request is denied and the primitive run needs that error. |
| License/feature entitlement validation | Org/product infrastructure. Skip for Pulse. |
| Bundler/deployer | Build/deploy operations, not user primitive execution. |
| PostHog telemetry | Product telemetry, not user observability. |
| Generic logger fanout/log listing | Logging infrastructure. Pulse may consume normalized log content, but logger plumbing should not emit Pulse. |
| Favorites, notification read/dismiss/list, channel installation/config CRUD | User/admin state management, not primitive execution. |
| MCP client/server catalog CRUD and versioning | Admin/configuration. Runtime MCP tool call applies; catalog management does not. |

## File-Specific Guidance

### `07-deeper-core-pulse-candidates.md`

| Section | Verdict | Guidance |
| --- | --- | --- |
| `memory` | Apply at caller | Keep memory events when they occur during agent/processor execution. Skip standalone config serialization and deprecated API telemetry. Thread create/update/delete applies only if caused by an agent/harness/channel run, not admin thread management. |
| `datasets` and `evals` | Apply selectively | Experiment run, per-item target execution, scorer execution, score save failure apply. Dataset CRUD/list/delete and experiment analytics/compare are admin/query operations; skip for initial Pulse. |
| `integration`, `tool-provider`, `processor-provider`, `relevance` | Mixed | Generated OpenAPI tool execution, runtime provider tool resolution for an agent, processor creation for a run, and relevance scoring apply. Tool/provider catalog listing, connection fields, health checks, and allowlist browsing skip. |
| `server`, `license`, `cache`, `bundler`, `deployer`, `hooks` | Mostly skip | Keep hook execution only if it is a user-defined hook in a primitive run. Skip server/auth/license/cache/bundler/deployer/editor/feature checks for now. |

### `08-runtime-surfaces-pulse-candidates.md`

| Section | Verdict | Guidance |
| --- | --- | --- |
| `tools` | Apply | Tool call lifecycle is a core Pulse surface. Prefer one coherent tool-call Pulse sequence over many low-level schema/build events. |
| Built-in interaction/task tools | Apply | `ask_user`, `submit_plan`, and task mutation/check/state-signal decisions are user primitive behavior. |
| `llm/model` routing and transport | Apply at model call | Route/auth/transport/cache decisions apply only when attached to a concrete model generate/stream/embed call. Model object construction outside a run should not emit. |

### `09-storage-observability-pulse-candidates.md`

| Section | Verdict | Guidance |
| --- | --- | --- |
| `observability` helpers | Apply at caller | Context creation/propagation should shape relationships, not emit standalone Pulses. `rag_ingestion` applies because it is a user-facing primitive-like operation. |
| Storage Composition and Initialization | Skip | Infrastructure boot and adapter plumbing. Do not add Pulse here initially. |
| Observability Storage Contract | Skip for user Pulse | Query/navigation APIs and storage capabilities should not emit Pulse. Storage writes are implementation details behind Pulse persistence. |
| Other Storage Domains | Mostly skip/apply at caller | Skip admin/config CRUD. Apply only through primitive callers such as task tools, workflow snapshots, memory processors, eval runner, or background-task runtime. |

### `10-protocol-telemetry-adapter-pulse-candidates.md`

| Section | Verdict | Guidance |
| --- | --- | --- |
| `a2a` | Apply | Remote A2A agent/subagent execution is user primitive work. Keep run/task/request/stream/suspend/resume pulses. |
| `tool-loop-agent` | Apply selectively | Runtime `prepareCall`/`prepareStep` processor behavior applies. One-time conversion/id generation is lower priority and can defer. |
| `agent-builder/ee` | Skip | Admin/UI policy derivation. Runtime denial during a primitive call can be represented later as an auth/policy error Pulse. |
| Telemetry and Logging | Skip/defer | Skip PostHog. Skip generic logger plumbing. Defer logger-to-Pulse bridging until Pulse ingestion design is clearer. |
| `request-context`, `action`, `voice`, `tts`, `error` | Apply at caller | Context and error utilities should enrich primitive Pulses. Voice/TTS applies where a voice provider actually executes for an agent/tool/workflow. |

## Suggested Initial Cut

Start implementation with these Pulse families:

1. `agent.*`
2. `workflow.*`
3. `tool.*`
4. `model.*`
5. `processor.*`
6. `scorer.*` / `eval.*`
7. `memory.*` only when attached to agent/processor execution
8. `signal.*` / `state_signal.*` only when attached to an agent thread/run
9. `harness.*`, `channel.*`, `a2a.*`, `code_mode.*` only when they carry work into or out of an agent/tool/workflow

Do not start with:

- `storage.*`
- `observability_storage.*`
- `server.*`
- `license.*`
- `telemetry.*`
- `editor.*`
- admin/catalog CRUD

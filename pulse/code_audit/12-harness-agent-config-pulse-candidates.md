# Harness And Agent Config Provenance Candidate Audit

Scope: follow-up audit notes from `fit_exploration_03`.

This file captures findings that belong in the code audit rather than the exploration folder:

- Harness v1 execution and interaction events that are good Pulse candidates.
- Agent Builder / Agent CMS style config provenance candidates.
- Versioned storage locations that can support provenance, but should generally not emit Pulse directly.

The key distinction: product surfaces such as Agent Builder or Agent CMS are not the important Pulse surface. The important fact is the domain result: agent config changed, tool definition changed, instructions changed, model settings changed, version published, etc.

## Summary

| Area | Verdict | Notes |
| --- | --- | --- |
| Harness runtime flow | Apply selectively | Good Pulse source, but avoid UI display snapshots. |
| Harness durable session state | Apply selectively | Pending items and suspend/resume state are useful as `Change` and `Relationship`; storage methods should not emit directly. |
| Agent config version creation | Config provenance | Candidate `Change`, probably emitted at product/API handler boundary. |
| Agent active version/status changes | Config provenance | Candidate `Change`; explains later runtime behavior. |
| Agent Builder picker/policy decisions | Mostly skip/defer | UI policy derivation itself is less important than durable config changes. Runtime denial during primitive execution can apply. |
| Agent CMS config mutations | Config provenance | Not a core folder name found in this pass, but maps to versioned agent storage and product/API handlers. |
| Versioned storage adapter internals | Apply at caller | Storage rows carry useful facts, but storage adapter calls are too low-level for Pulse emission. |

## Harness Runtime Candidates

Files inspected:

- `packages/core/src/harness/types.ts`
- `packages/core/src/harness/harness.ts`
- `packages/core/src/harness/session.ts`
- `packages/core/src/harness/session-run-engine.ts`
- `packages/core/src/storage/domains/harness/types.ts`
- `packages/core/src/storage/domains/harness/base.ts`

### Strong Candidates

| Source | Current Event/State | Candidate Export | Why |
| --- | --- | --- | --- |
| `harness/session.ts` `sendSignal(...)` | creates/accepts an Agent Signal for a thread | `Pulse(signal.accepted)` | User or notification input entering an agent flow. |
| `harness/session.ts` `sendMessage(...)` | user message becomes a signal | `Pulse(signal.accepted)` plus `Relationship(thread_contains_flow)` | Starts or joins a flow without needing a `messages` array. |
| `harness/session-run-engine.ts` `agent_start` | run begins | `Pulse(agent.run_started)` or flow origin | Useful flow boundary, but avoid recreating spans everywhere. |
| `harness/session-run-engine.ts` `agent_end` | run completes/aborts/errors/suspends | `Pulse(agent.run_finished)` | Can carry status and usage data when available. |
| `harness/session-run-engine.ts` `tool_start` | tool selected by model | `Pulse(tool.called)` | Core user-primitive behavior. |
| `harness/session-run-engine.ts` `tool_end` | tool result/error | `Pulse(tool.returned)` / `Pulse(tool.failed)` | Core user-primitive output/error. |
| `harness/session-run-engine.ts` `tool_approval_required` | tool gate opened | `Pulse(tool_approval.required)` | Execution decision point. |
| `harness/session.ts` `respondToToolApproval(...)` | human/session decision | `Pulse(tool_approval.approved)` / `Pulse(tool_approval.declined)` | Explains why a tool did or did not run. |
| `harness/session-run-engine.ts` `tool_suspended` | tool parked waiting for resume data | `Pulse(suspension.created)` plus `Change(harness_pending.pending_item_created)` | Strong runtime + durable state candidate. |
| `harness/session.ts` `resumeToolCall(...)` | resumed suspended tool | `Pulse(suspension.resumed)` plus `Relationship(resume_of)` | Links resumed flow to suspended pulse. |
| `harness/session.ts` `handlePlanApprovalResume(...)` | plan approval/rejection and optional mode switch | `Pulse(plan.approved/rejected)` plus config `Change` if mode changes | Human decision changes execution path. |
| `harness/session-run-engine.ts` `usage_update` | per-step token usage | `Pulse(model.usage_recorded)` | Numeric data belongs in `data`. |
| `harness/session-run-engine.ts` subagent events | subagent start/text/tool/end | `Pulse(agent.subagent_started)`, chunks, tool pulses, relationship to parent tool call | Nested agents should stay under the same root flow with explicit relationships. |
| `harness/session-run-engine.ts` task events | `task_updated` emits full task list | `Change(task.updated)` | Should be operations or refs, not repeated full task arrays. |
| `harness/session-run-engine.ts` OM lifecycle events | observation/reflection/buffering/activation | `Pulse(memory.observation_started/finished)` and `Change(context.compacted)` where state changes | Memory effects explain context evolution. |

### Skip Or Derive

| Source | Current Event/State | Verdict | Why |
| --- | --- | --- | --- |
| `harness/session.ts` `display_state_changed` | full display state snapshot | Skip | UI read-model artifact, not a primitive observation. |
| `harness/session-run-engine.ts` `message_update` | growing `HarnessMessage` snapshots | Skip direct emission | Use text/reasoning/tool chunks and context changes instead. |
| `harness/session.ts` thread list/read methods | query current threads/messages/settings | Skip | Navigation/query APIs, not agent primitive execution. |
| `harness/harness.ts` workspace ready/error events | workspace UI status | Defer | Apply only if workspace state affects a concrete agent/tool flow. |
| `storage/domains/harness/base.ts` `appendPendingItem/updatePendingItem/removePendingItem` | storage mutation helper | Apply at caller | Useful state facts, but emit from suspension/approval/resume caller, not storage domain. |

## Harness Pending State

`packages/core/src/storage/domains/harness/types.ts` defines:

- `HarnessSessionOrigin`: `top-level`, `subagent-tool`, `direct-local`, `remote-resolve`
- `HarnessPendingItemKind`: `tool-approval`, `tool-suspension`, `question`, `plan-approval`
- `HarnessPendingItemStatus`: `pending`, `responded`, `canceled`, `failed`

Candidate mappings:

| Pending Fact | Export | Notes |
| --- | --- | --- |
| pending item created | `Change(harness_pending.pending_item_created)` | The runtime Pulse should point at this Change if durable state matters. |
| pending item responded | `Change(harness_pending.pending_item_responded)` | Link to the user/external decision Pulse. |
| pending item canceled | `Change(harness_pending.pending_item_canceled)` | Useful for abort/interrupt analysis. |
| pending item failed | `Change(harness_pending.pending_item_failed)` | Useful for invalid resume or compatibility failures. |
| child session/source | `Relationship(subagent_of)` or `Relationship(remote_resolve_of)` | Better as relationship than duplicated attributes. |

Concern:

- Do not export every storage update as Pulse. The meaningful event is the suspension/approval/question lifecycle, not array persistence.

## Agent Config Provenance Candidates

Files inspected:

- `packages/core/src/agent-builder/ee/picker.ts`
- `packages/core/src/agent-builder/ee/policy.ts`
- `packages/core/src/agent-builder/ee/allowlist.ts`
- `packages/core/src/agent-builder/ee/normalize-candidate.ts`
- `packages/core/src/agent-builder/ee/errors.ts`
- `packages/core/src/storage/domains/agents/base.ts`
- `packages/core/src/storage/domains/agents/inmemory.ts`
- `packages/core/src/storage/domains/agents/filesystem.ts`
- `packages/core/src/storage/domains/agents/source.ts`
- `packages/core/src/storage/domains/versioned.ts`

### Important Change In Framing

Earlier audit notes treated Agent Builder policy derivation as `Skip` because it looked like admin/UI configuration. That is still true for picker visibility and policy helper calls by themselves.

The newer scope is different:

- user added an agent
- user added/removed a tool from an agent
- user changed instructions
- user changed model settings
- user published or activated a version

Those are not runtime Pulses, but they are strong `Change` candidates because they explain future agent behavior.

### Candidate Config Changes

| Domain Result | Candidate Export | Candidate Surface | Candidate Action | Notes |
| --- | --- | --- | --- | --- |
| agent created | `Change` | `agent_config` | `created` | Product source can be an attribute: `source: 'agent_builder'` or `source: 'agent_cms'`. |
| agent version created | `Change` | `agent_config` | `version_created` | Version rows already carry `changedFields`, `changeMessage`, `versionNumber`. |
| instructions changed | `Change` | `agent_config` | `instructions_changed` | Store content by ref/hash; do not duplicate instructions on every runtime flow. |
| tool added | `Change` | `agent_config` | `tool_added` | Tool definition/schema should be referenced by version/hash. |
| tool removed | `Change` | `agent_config` | `tool_removed` | Affects future tool availability and learning systems. |
| model settings changed | `Change` | `agent_config` | `model_changed` | Runtime model calls should reference the config version. |
| request context schema changed | `Change` | `agent_config` | `request_context_schema_changed` | Already a versioned config field in agent storage. |
| active version changed | `Change` | `agent_config` | `active_version_changed` | Thin agent row has `activeVersionId`; explains publish/rollback. |
| status changed | `Change` | `agent_config` | `status_changed` | Draft/published/archived can explain whether config was used. |
| version deleted | `Change` | `agent_config` | `version_deleted` | Probably lower priority; useful for provenance completeness. |
| agent deleted | `Change` | `agent_config` | `deleted` | Lower priority unless runtime refs point at deleted config. |

### Versioned Storage Support

The versioned storage domains already provide useful provenance fields:

- `versionNumber`
- `changedFields`
- `changeMessage`
- `createdAt`
- `activeVersionId`
- `resolvedVersionId`

Important storage locations:

| Location | Useful Fact | Emission Guidance |
| --- | --- | --- |
| `storage/domains/agents/inmemory.ts:create(...)` | creates thin agent record and initial version | Emit at Agent Builder/CMS/API handler boundary, not storage adapter. |
| `storage/domains/agents/inmemory.ts:createVersion(...)` | immutable version row with changed fields | Good source for `Change(agent_config.version_created)`. |
| `storage/domains/agents/filesystem.ts:createVersion(...)` | filesystem-backed version row | Same as above; storage backend should not change semantics. |
| `storage/domains/agents/source.ts:createVersion(...)` | source-control-backed version row and provider commit | Good source for relationship to commit/source version if product boundary exposes it. |
| `storage/domains/versioned.ts:resolveEntity(...)` | active/latest/specific version resolution | Do not emit directly; runtime flow should reference resolved config version. |

### Agent Builder Policy Helpers

| Location | Prior Candidate | Updated Verdict | Notes |
| --- | --- | --- | --- |
| `agent-builder/ee/picker.ts` | allowlist/picker visibility decisions | Skip/defer | UI visibility, not durable config result. |
| `agent-builder/ee/policy.ts` | model policy derivation | Skip/defer | Useful for UI/admin debugging, but not initial Pulse. |
| `agent-builder/ee/allowlist.ts` | allowlist checked/denied | Apply only at runtime denial | If a primitive run is blocked by policy, emit an error/decision Pulse there. |
| `agent-builder/ee/normalize-candidate.ts` | candidate normalized/invalid | Skip/defer | Candidate editing/admin validation unless it blocks runtime. |
| `agent-builder/ee/errors.ts` | builder-specific errors | Apply only when tied to config `Change` failure | Config save/publish failure can be a `Change` failure or error Pulse. |

## Agent CMS

No `agent-cms` source directory was found in `packages/core/src` in this pass. Treat Agent CMS as a product/API source that likely writes to the same agent versioned storage surfaces.

Candidate mapping:

```ts
{
  exportType: 'change',
  surface: 'agent_config',
  action: 'instructions_changed',
  subject: { kind: 'agent', id: 'agent_123' },
  previousVersion: 3,
  version: 4,
  operations: [
    {
      op: 'replace',
      path: '/instructions',
      valueRef: { kind: 'content', id: 'content_agent_instructions_v4' }
    }
  ],
  attributes: {
    source: 'agent_cms',
    changedFields: ['instructions']
  }
}
```

## Runtime Relationship To Config

When an agent flow runs, it should reference the config version it used instead of duplicating tool descriptions, schemas, instructions, and model settings.

Candidate relationships:

| Relationship | From | To | Why |
| --- | --- | --- | --- |
| `uses_config_version` | flow or root pulse | agent config version | Explains which instructions/tools/settings produced behavior. |
| `uses_tool_definition` | tool call pulse | tool definition/version | Avoids repeating schema/description every tool call. |
| `uses_instruction_version` | flow or model input pulse | instructions definition/version | Avoids repeating system prompt across flows. |
| `supersedes` | config change | prior config change/version | Useful for version history. |

Open question:

- If reduced family wins, config versions are `Change` records.
- If expanded family wins, config versions may be `Definition` records.

## Audit Corrections To Carry Forward

- Do not add Pulses to observability navigation/query APIs.
- Do not emit Pulse from storage adapter internals just because they write version rows.
- Do add config provenance as append-only `Change`/`Relationship` records when a user/product/API action changes agent behavior.
- Keep product source (`agent_builder`, `agent_cms`, import, API, code sync) as `attributes.source`, not as the main surface.
- Runtime flows should reference config versions instead of duplicating stable config payloads.


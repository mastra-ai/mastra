# Event Family Fit Matrix

This pass classifies runtime, config, definition, and thread candidates.

| Family | Source | Surface | Primitive Fit | Suggested Type | Suggested Action | Shape Notes | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Agent runtime turn | `packages/core/src/agent`, loop runtime | `agent` | agent | `input`, `progress`, `output`, `error` | `run_started`, `run_completed`, `run_failed` | One user turn should usually create one flow. | Apply |
| Model step/chunk | `loop.ts`, durable `llm-execution.ts`, observability `MODEL_STEP`/`MODEL_CHUNK` | `model` | agent/workflow | `progress`, `output`, `error` | `stream_started`, `text_chunk_emitted`, `step_completed` | Current chunk tracing is close to Pulse but should avoid span duration semantics. | Apply |
| Tool execution | `tools/tool-builder/builder.ts`, channel stream helpers | `tool` | agent/workflow/tool | `input`, `decision`, `output`, `error` | `execute_started`, `approval_requested`, `execute_completed`, `execute_failed` | Runtime Pulse should reference tool definition hash/version. | Apply |
| Tool definition | tool builder, editor stored tools, provider tools | `tool_config` or `tool` | tool/agent | `state` | `definition_registered` | Capture name, description, schemas, settings once per flow or revision. | Reference only |
| Agent stored create | `editor/namespaces/agent.ts`, `storage/domains/agents` | `agent_config` | agent | `state` | `agent_created`, `version_created` | This is config provenance, not storage CRUD. | Config provenance |
| Agent stored update | editor CRUD namespace, agent storage versions | `agent_config` | agent | `state` | `instructions_changed`, `tool_added`, `model_changed`, `version_created` | `changedFields` maps naturally to compact data and attributes. | Config provenance |
| Agent publish/activate version | agent storage `activeVersionId`, status | `agent_config` | agent | `state` | `version_published` | Runtime flows should reference active version used. | Config provenance |
| Code-defined agent override | `applyStoredOverrides` | `agent_config` | agent | `state`, `decision` | `override_applied`, `override_skipped` | Runtime-relevant because it changes instructions/tools at request time. | Apply selectively |
| Builder defaults applied | `applyBuilderDefaults` | `agent_config` | agent | `decision`, `state` | `defaults_applied` | Useful if it explains created agent config. Avoid repeating baseline defaults everywhere. | Config provenance |
| Workspace persisted for builder | `ensureStoredWorkspace` | `workspace_config` | workspace/agent | `state`, `error` | `workspace_registered`, `workspace_registration_failed` | Only meaningful when tied to agent config provenance. | Apply at caller |
| Stored skill publish | `editor/namespaces/skill.ts` | `skill_config` | skill/agent | `state` | `skill_published` | Relevant when agents reference versioned skills. | Config provenance |
| Stored scorer definition | scorer namespace/storage | `scorer_config` | scorer/agent | `state` | `scorer_created`, `scorer_changed`, `scorer_attached` | Relevant to later eval/runtime scores. | Config provenance |
| Thread group | memory/thread context | `thread` | agent | `state` | `flow_linked` | Needs flow-level relationship, not child Pulse links. | Apply |
| Thread CRUD | memory storage APIs | `thread` | agent | `state` | `thread_created`, `thread_updated` | Only apply when it represents user conversation state, not admin listing. | Apply selectively |
| Resource/user context | request context/memory | `thread` | agent | none | none | Usually metadata/context, not its own Pulse. | Reference only |
| Channel rendering | channel drivers | `channel` | agent | `output`, `progress`, `error` | `message_posted`, `tool_card_updated` | Useful for external user-visible delivery, but not core execution. | Apply selectively |
| Editor list/get APIs | editor namespaces | none | none | none | none | Navigation/query APIs do not explain execution behavior. | Skip |
| Favorites/pinning | editor favorites | none initially | none | none | none | Product preference, not execution/config provenance unless later used by learning. | Skip/defer |

## Main Classification Shift From Exploration 01

`storage/domains/agents` was previously mostly storage plumbing. In this pass, agent version creation and activation are not treated as generic storage operations. They are config provenance events because the storage model already encodes meaningful config revisions.

The distinction:

- `store.update(row)` by itself: skip
- `agent version 4 created with changedFields: ['instructions', 'tools']`: config provenance
- runtime agent flow references `agentVersionId: version_4`: reference

## Action Vocabulary Pressure

The family matrix pushes toward action vocabularies by surface.

Examples:

```ts
type AgentConfigAction =
  | 'agent_created'
  | 'version_created'
  | 'version_published'
  | 'instructions_changed'
  | 'tool_added'
  | 'tool_removed'
  | 'model_changed'
  | 'memory_changed'
  | 'workspace_changed';

type ToolAction =
  | 'definition_registered'
  | 'execute_started'
  | 'approval_requested'
  | 'execute_completed'
  | 'execute_failed';

type ThreadAction =
  | 'thread_created'
  | 'flow_linked'
  | 'flow_regenerated'
  | 'flow_branched';
```

If `action` is a free-form string, this matrix loses much of its value.

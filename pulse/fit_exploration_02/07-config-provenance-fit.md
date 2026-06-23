# Config Provenance Fit

This note tests Agent Builder / Agent CMS-like events against Pulse.

## Source Shape

The rebased source already has a strong config provenance substrate:

- `StorageAgentType` is a thin record with `status`, `activeVersionId`, `authorId`, `visibility`, `metadata`, timestamps, and favorites.
- `StorageAgentSnapshotType` holds the actual agent config: instructions, model, tools, workflows, agents, integrations, processors, memory, scorers, workspace, browser, skills, request context schema, and defaults.
- `AgentVersion` stores config snapshots with `versionNumber`, `changedFields`, and `changeMessage`.
- `EditorAgentNamespace` creates agents, applies builder defaults, persists referenced workspaces, applies stored overrides to code-defined agents, and hydrates stored config into runtime agents.

This means Pulse does not need to invent config diffs from scratch. It can record compact provenance and reference existing version IDs.

## Fit Pattern

Config mutation Pulse:

```ts
{
  type: 'state',
  surface: 'agent_config',
  action: 'version_created',
  primitive: {
    type: 'agent',
    id: 'support-agent',
    versionId: 'agent_version_4'
  },
  data: {
    versionNumber: 4,
    changedFieldCount: 2
  },
  attributes: {
    changedFields: ['instructions', 'tools'],
    changeMessage: 'Updated instructions, tools'
  },
  id: {
    flowId: 'flow_config_123',
    pulseId: 'pulse_1'
  },
  links: {}
}
```

Runtime flow reference:

```ts
{
  flowId: 'flow_run_456',
  originPulseId: 'pulse_origin',
  threadId: 'thread_abc',
  config: {
    agentId: 'support-agent',
    agentVersionId: 'agent_version_4'
  }
}
```

## Agent Builder Versus Agent Config

Prefer:

```ts
surface: 'agent_config'
action: 'tool_added'
```

Over:

```ts
surface: 'agent_builder'
action: 'clicked_add_tool'
```

Reason: the durable domain event is "tool was added to an agent." The actor/UI path can live in attributes if needed:

```ts
attributes: {
  source: 'agent_builder',
  actor: { type: 'user', id: 'user_123' }
}
```

## Builder Defaults

`applyBuilderDefaults` applies admin/baseline defaults during creation, including memory baseline and admin default model.

Possible Pulse:

```ts
{
  type: 'decision',
  surface: 'agent_config',
  action: 'defaults_applied',
  primitive: { type: 'agent', id: 'support-agent' },
  attributes: {
    appliedFields: ['memory', 'model'],
    source: 'builder'
  },
  data: {
    changedFieldCount: 2
  }
}
```

Concern: this may be too noisy if every builder-created agent receives the same defaults. It may be better folded into the `agent_created` / `version_created` Pulse as attributes.

## Stored Overrides

`applyStoredOverrides` can change runtime behavior of code-defined agents by applying stored instructions and tool description/selection overrides.

This is both config provenance and runtime decision.

Good runtime Pulse:

```ts
{
  type: 'decision',
  surface: 'agent_config',
  action: 'override_applied',
  primitive: {
    type: 'agent',
    id: 'code-agent',
    versionId: 'agent_version_9'
  },
  attributes: {
    status: 'draft',
    appliedFields: ['instructions', 'tools']
  }
}
```

This is different from the config mutation Pulse that created `agent_version_9`.

## Skip Cases

Skip:

- editor namespace cache hits/misses
- list/get resolved calls used for UI navigation
- workspace reconciliation logs unless they create or archive a config entity
- storage adapter create/update calls without domain interpretation

## Current Leaning

Config provenance should be recorded at domain mutation boundaries:

- create agent
- create config version
- publish/activate version
- archive/delete agent
- attach/detach tool/workflow/scorer/skill
- change instructions/model/memory/default options

Runtime flows should reference the version used, not copy all config fields.

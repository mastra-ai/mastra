# Full Scenario Test

This scenario tests the candidate model across a single agent run with durable definitions, scoped changes, temporary definitions, and runtime observations.

## Scenario

An agent starts with published config version 4:

- instructions v4
- model settings v2
- tools: `searchDocs`, `summarize`, `createIssue`
- request context schema v1
- structured output disabled

During the run:

1. request context validates against schema v1
2. processor narrows active tools for step 1 to `searchDocs`
3. model calls `searchDocs`
4. processor enables structured output for step 2 with a runtime schema
5. model settings are overridden for one internal structuring call
6. run finishes

## Definition Artifacts

```ts
[
  { kind: 'agent_config', id: 'agent_config_support_v4', version: 4, hash: 'sha256:agent-v4' },
  { kind: 'instructions', id: 'instructions_support_v4', hash: 'sha256:instructions-v4' },
  { kind: 'model_settings', id: 'model_settings_support_v2', hash: 'sha256:model-settings-v2' },
  { kind: 'tool_definition', id: 'tool_searchDocs_v2', hash: 'sha256:searchDocs-v2' },
  { kind: 'tool_definition', id: 'tool_summarize_v1', hash: 'sha256:summarize-v1' },
  { kind: 'tool_definition', id: 'tool_createIssue_v1', hash: 'sha256:createIssue-v1' },
  { kind: 'request_context_schema', id: 'request_context_support_v1', hash: 'sha256:rcs-v1' }
]
```

Observation:

- These are bodies/contracts. They are not themselves the runtime observations.
- Version creation/publish events would be ChangePulses outside this run.

## Run Start

```ts
{
  exportType: 'pulse',
  pulseKind: 'observation',
  id: 'pulse_run_started',
  timestamp: '2026-08-10T10:00:00.000Z',
  type: 'input',
  surface: 'agent',
  action: 'run_started',
  attributes: {
    agentId: 'support-agent',
    runId: 'run_123'
  }
}
```

Relationships:

```ts
[
  {
    exportType: 'relationship',
    relationship: 'uses_config_version',
    from: { kind: 'pulse', id: 'pulse_run_started' },
    to: { kind: 'definition', id: 'agent_config_support_v4' }
  },
  {
    exportType: 'relationship',
    relationship: 'uses_instruction_version',
    from: { kind: 'pulse', id: 'pulse_run_started' },
    to: { kind: 'definition', id: 'instructions_support_v4' }
  },
  {
    exportType: 'relationship',
    relationship: 'uses_definition',
    from: { kind: 'pulse', id: 'pulse_run_started' },
    to: { kind: 'definition', id: 'request_context_support_v1' }
  }
]
```

## Step 1 Active Tool Narrowing

```ts
{
  exportType: 'pulse',
  pulseKind: 'change',
  id: 'pulse_step1_active_tools',
  timestamp: '2026-08-10T10:00:01.000Z',
  surface: 'tool_config',
  action: 'active_tools_changed',
  subject: { kind: 'agent_step', id: 'step_1' },
  scope: { type: 'step', stepId: 'step_1' },
  operations: [
    { op: 'replace', path: '/activeTools', value: ['searchDocs'] }
  ]
}
```

Relationship:

```ts
{
  exportType: 'relationship',
  relationship: 'uses_tool_definition',
  from: { kind: 'pulse', id: 'pulse_step1_active_tools' },
  to: { kind: 'definition', id: 'tool_searchDocs_v2' }
}
```

Observation:

- The tool definition is reused; the Pulse records scope/applicability.
- No new tool definition is needed.

## Tool Call

```ts
{
  exportType: 'pulse',
  pulseKind: 'observation',
  id: 'pulse_searchDocs_called',
  timestamp: '2026-08-10T10:00:02.000Z',
  type: 'input',
  surface: 'tool',
  action: 'called',
  attributes: {
    toolName: 'searchDocs',
    input: { query: 'billing retry policy' }
  }
}
```

Relationship:

```ts
{
  exportType: 'relationship',
  relationship: 'uses_tool_definition',
  from: { kind: 'pulse', id: 'pulse_searchDocs_called' },
  to: { kind: 'definition', id: 'tool_searchDocs_v2' }
}
```

Observation:

- Runtime Pulse carries the input item.
- Definition ref avoids repeating description/schema/approval settings.

## Step 2 Structured Output Schema

```ts
{
  exportType: 'pulse',
  pulseKind: 'change',
  id: 'pulse_structured_schema_selected',
  timestamp: '2026-08-10T10:00:03.000Z',
  surface: 'processor',
  action: 'structured_output_schema_selected',
  subject: { kind: 'agent_step', id: 'step_2' },
  scope: { type: 'step', stepId: 'step_2' },
  attributes: {
    definition: {
      kind: 'schema',
      id: 'schema_structured_step_2',
      hash: 'sha256:structured-step-2',
      bodyRef: { kind: 'content', id: 'content_structured_schema_step_2' }
    }
  }
}
```

Observation:

- This is the best stress case for `DefinitionPulse`, but ChangePulse still reads cleaner because the processor selected a schema for a step-scoped runtime contract.
- If the same schema was part of durable agent config, it should be a referenced artifact instead.

## One-Call Model Settings Override

```ts
{
  exportType: 'pulse',
  pulseKind: 'change',
  id: 'pulse_structuring_model_settings',
  timestamp: '2026-08-10T10:00:04.000Z',
  surface: 'model',
  action: 'settings_selected',
  subject: { kind: 'model_call', id: 'model_call_structuring_1' },
  scope: { type: 'model_call', pulseId: 'pulse_structuring_model_call' },
  attributes: {
    definition: {
      kind: 'model_settings',
      id: 'model_settings_structuring_call_1',
      hash: 'sha256:structuring-settings-1',
      body: { temperature: 0, providerOptions: { openai: { reasoningEffort: 'low' } } }
    }
  }
}
```

Observation:

- Embedded temporary body is acceptable because it is one-call scoped and only useful through the selecting Pulse.
- If it becomes referenced across calls, promote to a definition artifact.

## Result

The hybrid model handles this scenario without:

- copying durable config into every runtime Pulse
- turning config bodies into fake observations
- creating a Flow envelope
- using Snapshot
- losing step/call-level temporary scope

Remaining dependency:

- Relationship graph design must define where these `uses_*`, step membership, and ordering relationships live.

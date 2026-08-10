# Worked Examples

These examples use compact pseudo-records to test whether definitions should be artifacts, special Pulses, or ChangePulse payloads.

## 1. Permanent Agent Instructions Changed

User publishes agent version 4 with updated instructions.

```ts
{
  exportType: 'pulse',
  pulseKind: 'change',
  id: 'pulse_change_agent_v4',
  timestamp: '2026-08-10T09:00:00.000Z',
  surface: 'agent_config',
  action: 'version_created',
  subject: { kind: 'agent', id: 'support-agent' },
  scope: 'permanent',
  attributes: {
    versionId: 'agent_version_4',
    versionNumber: 4,
    changedFields: ['instructions'],
    definitions: [
      {
        kind: 'instructions',
        id: 'instructions_support_agent_v4',
        hash: 'sha256:instructions-v4',
        bodyRef: { kind: 'content', id: 'content_instructions_v4' },
      },
    ],
  },
}
```

Later runtime:

```ts
{
  exportType: 'relationship',
  relationship: 'uses_instruction_version',
  from: { kind: 'pulse', id: 'pulse_agent_run_started' },
  to: { kind: 'definition', id: 'instructions_support_agent_v4' },
}
```

Observation:

- A separate referenced definition reads well here. The ChangePulse records the version event; the definition body gives runtime refs a semantic target.
- Pure `ChangePulse` references are weaker: `uses change pulse_change_agent_v4` does not say whether the runtime used instructions, model settings, tools, or the whole agent version.

## 2. Temporary Runtime Override Changes Model Settings For One Call

A call-site override changes temperature for one model call.

```ts
{
  exportType: 'pulse',
  pulseKind: 'change',
  id: 'pulse_change_model_settings_call_1',
  timestamp: '2026-08-10T09:01:00.000Z',
  surface: 'model',
  action: 'settings_selected',
  subject: { kind: 'model_call', id: 'model_call_1' },
  scope: 'temporary',
  attributes: {
    appliesTo: { kind: 'pulse', id: 'pulse_model_call_1' },
    definition: {
      kind: 'model_settings',
      id: 'model_settings_call_1',
      hash: 'sha256:model-settings-call-1',
      body: {
        temperature: 0.2,
        providerOptions: { openai: { reasoningEffort: 'low' } },
      },
    },
  },
}
```

Observation:

- This fits as a ChangePulse with embedded definition because the scope is tiny and the body is not reusable.
- Promoting every one-call setting override into a separate durable definition artifact would create noise.

## 3. Tool Set Changes For Remainder Of Run

A processor or runtime policy restricts available tools to `searchDocs` and `summarize` until replaced or the run ends.

```ts
{
  exportType: 'pulse',
  pulseKind: 'change',
  id: 'pulse_change_toolset_run',
  timestamp: '2026-08-10T09:02:00.000Z',
  surface: 'tool_config',
  action: 'tool_set_changed',
  subject: { kind: 'run', id: 'run_123' },
  scope: 'permanent',
  attributes: {
    appliesUntil: 'run_end_or_replaced',
    toolRefs: [
      { kind: 'definition', id: 'tool_searchDocs_v2' },
      { kind: 'definition', id: 'tool_summarize_v1' },
    ],
  },
}
```

Observation:

- Permanent means "keeps applying until another change replaces it," not "stored forever."
- This should be a ChangePulse over a tool-set definition/ref list, not a new Flow or Snapshot.

## 4. Tool Set Changes Only For Next Step

`ProcessorRunner` supports processors returning `activeTools` for a step. A processor narrows `['tool1', 'tool2', 'tool3']` to `['tool1']`.

```ts
{
  exportType: 'pulse',
  pulseKind: 'change',
  id: 'pulse_change_toolset_step_4',
  timestamp: '2026-08-10T09:03:00.000Z',
  surface: 'tool_config',
  action: 'active_tools_changed',
  subject: { kind: 'agent_step', id: 'step_4' },
  scope: 'temporary',
  operations: [
    {
      op: 'replace',
      path: '/activeTools',
      value: ['tool1'],
    },
  ],
  attributes: {
    processorId: 'tool-filter',
    appliesUntil: 'step_end',
  },
}
```

Observation:

- This is clearly a ChangePulse, not a reusable Definition artifact.
- It should reference tool definitions if needed, but the changed fact is the active set for one step.

## 5. Stored Tool Definition Referenced By Multiple Calls

Tool body:

```ts
{
  kind: 'tool_definition',
  id: 'tool_searchDocs_v2',
  hash: 'sha256:searchDocs-v2',
  scope: 'permanent',
  body: {
    name: 'searchDocs',
    description: 'Search documentation.',
    inputSchemaRef: { kind: 'definition', id: 'schema_searchDocs_input_v2' },
    outputSchemaRef: { kind: 'definition', id: 'schema_searchDocs_output_v1' },
    requireApproval: false,
    suspendSupport: false,
  },
}
```

Runtime call:

```ts
{
  exportType: 'relationship',
  relationship: 'uses_tool_definition',
  from: { kind: 'pulse', id: 'pulse_tool_searchDocs_called' },
  to: { kind: 'definition', id: 'tool_searchDocs_v2' },
}
```

Observation:

- Tool definition is the strongest case for a separate referenced artifact. Runtime calls can stay lean and avoid copying description/schemas/approval settings.
- Tool schema can be nested in the tool definition unless transformed/generated independently.

## 6. Run-Local Generated Tool Schema

An OpenAPI toolset generates `getInvoice` from a client method and schema at runtime.

```ts
{
  exportType: 'pulse',
  pulseKind: 'change',
  id: 'pulse_select_getInvoice_tool',
  timestamp: '2026-08-10T09:04:00.000Z',
  surface: 'tool_config',
  action: 'tool_definition_selected',
  scope: 'temporary',
  subject: { kind: 'run', id: 'run_123' },
  attributes: {
    definition: {
      kind: 'tool_definition',
      id: 'tool_getInvoice_run_123',
      hash: 'sha256:getInvoice-run-123',
      bodyRef: { kind: 'content', id: 'content_tool_getInvoice_schema' },
    },
  },
}
```

Observation:

- This is the strongest temporary-definition case, but ChangePulse still reads better because the observable fact is that a generated tool definition became available for the run.
- `DefinitionPulse` should remain provisional unless this ChangePulse shape becomes too vague in the relationship experiment.

## 7. Request Context Schema Changed

Agent version adds a JSON Schema for `tenantId`.

```ts
{
  exportType: 'pulse',
  pulseKind: 'change',
  id: 'pulse_change_request_context_schema',
  timestamp: '2026-08-10T09:05:00.000Z',
  surface: 'agent_config',
  action: 'request_context_schema_changed',
  subject: { kind: 'agent', id: 'support-agent' },
  scope: 'permanent',
  attributes: {
    versionId: 'agent_version_5',
    definition: {
      kind: 'request_context_schema',
      id: 'request_context_schema_support_agent_v5',
      hash: 'sha256:rcs-v5',
      bodyRef: { kind: 'content', id: 'content_rcs_v5' },
    },
  },
}
```

Runtime validation failure:

```ts
{
  exportType: 'pulse',
  pulseKind: 'observation',
  id: 'pulse_request_context_invalid',
  timestamp: '2026-08-10T09:06:00.000Z',
  type: 'error',
  surface: 'agent',
  action: 'request_context_validation_failed',
  attributes: {
    schemaRef: { kind: 'definition', id: 'request_context_schema_support_agent_v5' },
    missing: ['tenantId'],
  },
}
```

Observation:

- The schema body is reusable and should be referenced.
- The validation failure is a runtime Pulse, not a definition.

## 8. Config Save Fails

Source-backed storage fails while creating version 2.

```ts
{
  exportType: 'pulse',
  pulseKind: 'observation',
  id: 'pulse_agent_config_save_failed',
  timestamp: '2026-08-10T09:07:00.000Z',
  type: 'error',
  surface: 'agent_config',
  action: 'version_create_failed',
  attributes: {
    agentId: 'support-agent',
    attemptedChangedFields: ['instructions'],
    source: 'agent_builder',
  },
}
```

Observation:

- Do not create a reusable definition when the commit/save failed.
- The failed attempt may still be an error Pulse if it is user-visible or explains why later runtime did not change.

## 9. Admin UI Browses Config

User opens the config page and lists versions.

Observation:

- Skip. No domain definition changed and no runtime behavior was selected.
- If the user publishes/activates a version from that page, emit the committed domain ChangePulse at that boundary.

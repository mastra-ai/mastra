# Worked Examples

These examples test the candidate shape from this pass. They are illustrative, not final API proposals.

## Agent Config Version Created

```ts
const flow = {
  flowId: 'flow_config_001',
  originPulseId: 'pulse_config_001',
};

const pulse = {
  timestamp: '2026-06-23T09:00:00.000Z',
  type: 'state',
  surface: 'agent_config',
  action: 'version_created',
  primitive: {
    type: 'agent',
    id: 'support-agent',
    versionId: 'agent_version_4',
  },
  data: {
    versionNumber: 4,
    changedFieldCount: 2,
  },
  attributes: {
    changedFields: ['instructions', 'tools'],
    changeMessage: 'Updated instructions, tools',
    source: 'agent_cms',
  },
  id: {
    flowId: 'flow_config_001',
    pulseId: 'pulse_config_001',
  },
  links: {},
};
```

Observation:

- This fits because it captures a meaningful domain mutation, not raw storage CRUD.
- `versionId` lets runtime flows reference the config without copying instructions/tools.
- `source: 'agent_cms'` is useful, but should not be the surface.

## Agent Builder Created Agent With Defaults

```ts
const pulses = [
  {
    timestamp: '2026-06-23T09:01:00.000Z',
    type: 'state',
    surface: 'agent_config',
    action: 'agent_created',
    primitive: {
      type: 'agent',
      id: 'sales-drop-watcher',
      versionId: 'agent_version_1',
    },
    data: {
      versionNumber: 1,
      changedFieldCount: 5,
    },
    attributes: {
      source: 'agent_builder',
      changedFields: ['name', 'description', 'instructions', 'model', 'memory'],
    },
    id: { flowId: 'flow_config_002', pulseId: 'pulse_1' },
    links: { next: 'pulse_2' },
  },
  {
    timestamp: '2026-06-23T09:01:00.100Z',
    type: 'decision',
    surface: 'agent_config',
    action: 'defaults_applied',
    primitive: {
      type: 'agent',
      id: 'sales-drop-watcher',
      versionId: 'agent_version_1',
    },
    attributes: {
      appliedFields: ['memory'],
      defaultSource: 'builder_baseline',
    },
    data: {
      changedFieldCount: 1,
    },
    id: { flowId: 'flow_config_002', pulseId: 'pulse_2' },
    links: { prev: 'pulse_1' },
  },
];
```

Observation:

- The second Pulse may be too much. It is useful only if defaults materially explain later behavior.
- If defaults are always applied, fold them into the `agent_created` Pulse.

## Runtime Agent Turn References Config And Previous Turn

```ts
const flow = {
  flowId: 'flow_turn_002',
  originPulseId: 'pulse_origin',
  threadId: 'thread_support_123',
  previousFlowId: 'flow_turn_001',
  config: {
    agentId: 'support-agent',
    agentVersionId: 'agent_version_4',
  },
};

const pulse = {
  timestamp: '2026-06-23T09:05:00.000Z',
  type: 'input',
  surface: 'agent',
  action: 'run_started',
  primitive: {
    type: 'agent',
    id: 'support-agent',
    versionId: 'agent_version_4',
  },
  attributes: {
    input: {
      messageId: 'msg_002',
    },
  },
  id: {
    flowId: 'flow_turn_002',
    pulseId: 'pulse_origin',
  },
  links: {},
};
```

Observation:

- `threadId` groups the conversation.
- `previousFlowId` gives explicit turn order.
- Pulse-level links stay inside `flow_turn_002`.

## Tool Definition Registered Then Referenced

```ts
const definitionPulse = {
  timestamp: '2026-06-23T09:05:00.050Z',
  type: 'state',
  surface: 'tool',
  action: 'definition_registered',
  primitive: {
    type: 'agent',
    id: 'support-agent',
    versionId: 'agent_version_4',
  },
  attributes: {
    tool: {
      id: 'searchDocs',
      definitionHash: 'sha256:tooldef_abc',
      description: 'Search documentation.',
      inputSchema: {},
      outputSchema: {},
      requireApproval: false,
      hasSuspendSchema: false,
    },
  },
  id: { flowId: 'flow_turn_002', pulseId: 'pulse_tool_def' },
  links: { parent: 'pulse_origin', next: 'pulse_tool_call' },
};

const callPulse = {
  timestamp: '2026-06-23T09:05:02.000Z',
  type: 'input',
  surface: 'tool',
  action: 'execute_started',
  primitive: {
    type: 'agent',
    id: 'support-agent',
    versionId: 'agent_version_4',
  },
  attributes: {
    tool: {
      id: 'searchDocs',
      callId: 'call_123',
      definitionHash: 'sha256:tooldef_abc',
    },
    input: {
      query: 'refund policy',
    },
  },
  id: { flowId: 'flow_turn_002', pulseId: 'pulse_tool_call' },
  links: { parent: 'pulse_origin', prev: 'pulse_tool_def' },
};
```

Observation:

- This removes the need to repeat description/schema on each call.
- The definition Pulse may still be too heavy if emitted every flow. A separate definition store may be better.

## Aggregated Model Text Chunk

```ts
const pulse = {
  timestamp: '2026-06-23T09:05:03.000Z',
  type: 'progress',
  surface: 'model',
  action: 'text_chunk_emitted',
  primitive: {
    type: 'agent',
    id: 'support-agent',
    versionId: 'agent_version_4',
  },
  text: 'The refund policy allows returns within 30 days...',
  data: {
    chunkIndex: 3,
    characterCount: 51,
  },
  attributes: {
    messageId: 'msg_assistant_002',
    aggregation: {
      mode: 'text_delta_batch',
      deltaCount: 12,
    },
  },
  id: { flowId: 'flow_turn_002', pulseId: 'pulse_chunk_003' },
  links: {
    parent: 'pulse_model_step_001',
    prev: 'pulse_chunk_002',
    next: 'pulse_chunk_004',
  },
};
```

Observation:

- This keeps the spirit of `MODEL_CHUNK` while avoiding one Pulse per token delta.
- `text` is useful here and agent-readable, but may need redaction policy later.

## Stored Override Applied To Code Agent

```ts
const pulse = {
  timestamp: '2026-06-23T09:10:00.000Z',
  type: 'decision',
  surface: 'agent_config',
  action: 'override_applied',
  primitive: {
    type: 'agent',
    id: 'code-defined-support-agent',
    versionId: 'agent_version_9',
  },
  attributes: {
    status: 'draft',
    appliedFields: ['instructions', 'tools'],
    skippedFields: ['model'],
  },
  data: {
    changedFieldCount: 2,
  },
  id: { flowId: 'flow_turn_003', pulseId: 'pulse_override' },
  links: { parent: 'pulse_origin' },
};
```

Observation:

- This is runtime-relevant because the stored override changes behavior of a code-defined agent.
- It is a decision Pulse in the runtime flow, separate from the config mutation that created the version.

## No Pulse: Editor List Agents

```ts
// No Pulse
await editor.agent.list({ status: 'draft' });
```

Observation:

- Listing agents powers UI/navigation.
- It does not explain what an agent did or why runtime behavior changed.

## No Pulse: Storage Adapter Update Without Domain Context

```ts
// No Pulse by itself
await adapter.update(input);
```

Observation:

- The generic adapter call is not the semantic event.
- The semantic event is the domain mutation, such as `agent_config.version_created`.

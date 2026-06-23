# Definition Reference Fit

This note tests definition-once/reference-many capture.

## Source Shape

`CoreToolBuilder` has access to the definition details worth preserving:

- description
- processed input schema
- processed output schema
- approval requirement
- suspend schema presence
- provider options
- MCP metadata
- input examples
- background config
- tool id/name
- tool type

Current tool execution spans include `toolDescription` and `toolType` on every tool call. That is useful but duplicative and incomplete.

## Fit Pattern

Definition Pulse:

```ts
{
  type: 'state',
  surface: 'tool',
  action: 'definition_registered',
  primitive: {
    type: 'agent',
    id: 'research-agent',
    versionId: 'agent_version_4'
  },
  attributes: {
    tool: {
      id: 'searchDocs',
      definitionHash: 'sha256:tooldef...',
      name: 'searchDocs',
      description: 'Search documentation.',
      inputSchema: {},
      outputSchema: {},
      requireApproval: false,
      hasSuspendSchema: false,
      source: 'registry'
    }
  }
}
```

Runtime call Pulse:

```ts
{
  type: 'input',
  surface: 'tool',
  action: 'execute_started',
  primitive: {
    type: 'agent',
    id: 'research-agent',
    versionId: 'agent_version_4'
  },
  attributes: {
    tool: {
      id: 'searchDocs',
      definitionHash: 'sha256:tooldef...',
      callId: 'call_123'
    },
    input: {
      query: 'memory processors'
    }
  }
}
```

## When To Emit Definition Data

Options:

1. Emit all definitions at flow start.
2. Emit definition on first use within a flow.
3. Emit definition only when definition hash is unknown to storage.
4. Store definitions outside Pulse and reference them from Pulses.

Current leaning:

- runtime flow should reference definitions by hash/version
- definition detail should be captured once per unique definition hash
- a `definition_registered` Pulse may be useful when the definition first becomes relevant to a flow, but permanent definition storage may be cleaner than making Pulse carry schemas

## Why Not Repeat Description On Every Call

Repeating tool descriptions on every call:

- duplicates static config
- misses schemas/settings
- makes child Pulses heavier
- increases redaction surface
- does not explain whether the definition changed between runs

Referencing a hash/version:

- keeps call Pulses lean
- allows richer definition capture
- lets learning systems compare behavior across definition changes

## Schema Payload Problem

Schemas are large structured objects. They fit poorly in `data` and ambiguously in `attributes`.

Possible correction to Pulse shape:

```ts
definition?: {
  kind: 'tool';
  id: string;
  hash: string;
  schema?: unknown;
}
```

Concern: adding `definition` makes Pulse less single-shaped. But leaving schemas in `attributes` makes field meaning vague.

## Current Leaning

Use Pulse for definition lifecycle observations and runtime references, but consider separate definition records for full schemas.

Pulse should answer:

- which definition did this call use?
- did the definition change?
- was this definition registered or attached to the flow?

A separate definition object may answer:

- what is the full input schema?
- what is the full output schema?
- what provider/toolkit produced it?

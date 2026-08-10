# Adversarial Review

This pass tries to break the hybrid definition model from `09-candidate-model.md`.

## Challenge 1: Does `DefinitionRef` Create A Second Event Model?

Risk: once definitions have ids, versions, hashes, storage rows, and query APIs, they can start acting like another exported observability family.

Boundary that keeps the model coherent:

- definition artifacts are bodies/contracts, not observations
- definition artifacts do not carry event semantics like `timestamp`, `level`, `surface`, `action`, or lifecycle state
- creation, update, publish, activation, selection, use, and validation failure are Pulses
- relationships connect runtime Pulses to the bodies/contracts they used

This means an agent config version, tool definition, or schema can be indexed and reused without pretending the body itself "happened."

Failure mode:

- `Definition` grows event fields
- definition lifecycle is recorded outside Pulse
- runtime queries need to inspect definition rows to know what happened

If those happen, `Definition` has become a sibling export family and the model should be reconsidered.

## Challenge 2: Can `DefinitionPulse` Be Removed Entirely?

Mostly yes.

The structured-output example in `10-full-scenario.md` can be represented as a ChangePulse:

```ts
{
  exportType: 'pulse',
  pulseKind: 'change',
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

That reads better than adding a third Pulse kind. The important fact is not only that a schema exists; it is that the processor selected a schema for a scoped runtime use.

Keep `DefinitionPulse` provisional and rare. It may still be useful when the act of introducing a definition is itself the runtime observation and there is no clearer mutation target. Even then, test whether `ChangePulse` with `surface`, `action`, `subject`, and `scope` is enough first.

## Challenge 3: Does Scope Belong On The Definition Or The Relationship?

Use two different scopes:

- intrinsic scope: where the definition body is valid or versioned
- applicability scope: where a specific change or use applies

Examples:

- A stored `searchDocs` tool definition has no run-specific intrinsic scope.
- A ChangePulse can select only `searchDocs` for `step_1`; that applicability is step-scoped.
- A one-call model settings override may have both a model-call applicability scope and no meaningful reusable artifact outside that call.

The same definition can be used at different scopes. Therefore, applicability scope should usually live on the ChangePulse or relationship, not on the reusable definition body.

## Challenge 4: Are Instructions, Settings, And Tool Sets Definitions Or Content?

They can be either, depending on role.

Content:

- a new message body entering context
- a memory pull result added to the current message array
- model output text produced during a run

Definition:

- reusable instructions that govern future behavior
- a tool schema/description/approval contract
- a model settings bundle selected for one or more calls
- a structured output schema used as a contract

Rule: if the body is part of the conversational/context material being reconstructed, treat it as content owned by the introducing Pulse. If the body governs behavior and can be referenced by runtime Pulses, treat it as a definition body or inline definition.

## Challenge 5: Does The Model Depend Too Much On Relationships?

Yes.

Definition references need relationship graph semantics for:

- `uses_config_version`
- `uses_instruction_version`
- `uses_tool_definition`
- `uses_definition`
- step membership and ordering
- scoped override applicability

This is acceptable only if the Flow / Relationship Graph experiment can show purpose-named relationships reconstruct the execution cleanly. Otherwise, definition refs may force too much indirection into readers.

## Revised Leaning

The hybrid survives this review, but the preferred default should be stricter:

1. Use referenced definition artifacts for durable or reusable bodies.
2. Use ChangePulses for lifecycle, selection, and scoped applicability.
3. Use inline definition bodies for one-off temporary contracts.
4. Keep `DefinitionPulse` as a provisional escape hatch, not a core family member.
5. Push runtime meaning through purpose-named relationships rather than overloaded parent/config fields.


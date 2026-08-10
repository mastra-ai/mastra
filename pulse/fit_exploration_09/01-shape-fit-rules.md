# Shape Fit Rules

This exploration starts from the current working model rather than inventing a new branch-refresh export family.

## Candidate Export Families

```ts
type PulseExport =
  | Pulse
  | ChangePulse
  | DefinitionReference
  | PulseRelationship;
```

Snapshots remain an escape hatch only. They should not be used for repeated session, display, workflow, or message-array state.

## Pulse Rule

Use a Pulse for an observable runtime fact at a point in time:

- content introduced
- model input assembled
- tool or task execution fact
- approval/suspension fact
- experiment/scorer lifecycle fact
- workflow/schedule lifecycle fact
- concrete model call decision

## ChangePulse Rule

Use a ChangePulse when active behavior changes:

- model/mode selection changes
- tool approval policy changes
- active skill set changes
- instruction/config applicability changes
- temporary next-step overrides
- run-scoped or persisted setting updates

## Definition Rule

Definitions are referenced bodies or revisions, not copied payloads on every runtime Pulse.

Use definitions for:

- agent instructions
- tool schemas
- skill metadata
- workflow definitions
- scorer definitions
- model/provider capability tables

Runtime Pulses should reference the definition/version they used.

## Relationship Rule

Use exported relationships for graph, reconstruction, and applicability facts:

- `caused_by`
- `included_in_model_input`
- `uses_definition`
- `queued_for_run`
- `resumed_from`
- `result_of`
- `interrupts`
- `replaces`

Avoid embedding all relationship types directly on every Pulse object.

## Skip Rule

Skip by default:

- display mirrors
- adapter rendering details
- pubsub subscription setup/teardown
- storage cleanup
- generated provider registry churn
- list/read/admin storage APIs

## Devil's Advocate

This shape may be too conservative. Agent Controller sessions and experiments are rich enough that a domain-specific export family could be tempting. The counterargument is that adding another top-level family would make Pulse less universal before we have proven the current Pulse/Change/Definition/Relationship model fails. This exploration should look for concrete failure cases, not category discomfort.

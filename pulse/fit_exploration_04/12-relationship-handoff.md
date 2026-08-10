# Relationship Graph Handoff

The Definition experiment now depends on the Flow / Relationship Graph experiment. This file captures the relationship requirements that fell out of the definition pass.

## Required Relationship Jobs

Definition references need relationships to handle at least these jobs:

| Job | Candidate relationship | From | To |
| --- | --- | --- | --- |
| run started with config version | `uses_config_version` | run-start Pulse | agent config definition |
| run started with instruction version | `uses_instruction_version` | run-start Pulse | instruction definition |
| tool call used tool contract | `uses_tool_definition` | tool-call Pulse | tool definition |
| model call used selected settings | `uses_definition` or `uses_model_settings` | model-call Pulse | model settings definition |
| request context was validated by schema | `validated_against` | validation Pulse | schema definition |
| processor selected a step-local schema | `uses_definition` | ChangePulse | schema definition or inline body ref |
| processor narrowed active tools | `enables_definition` / `disables_definition` | ChangePulse | tool definition |
| output was shaped by structured-output schema | `shaped_by` | output Pulse | schema definition |

The relationship experiment should test whether purpose-named edges stay understandable, or whether a smaller typed vocabulary plus attributes is better.

## Applicability Scope

Scoped definition changes need one of these approaches:

1. scope lives on the ChangePulse
2. scope lives on the relationship edge
3. scope is represented by another target node, such as a step/run/model-call Pulse

Current leaning from this pass:

- durable intrinsic scope can live on the definition artifact or referenced config version
- runtime applicability scope should live on the ChangePulse, with relationships connecting the change to the affected definitions
- using Pulses can repeat the relationship to the active definition when useful for query speed or explanation

The next experiment should decide whether repeated `uses_*` edges are acceptable or whether scoped changes should imply later uses until superseded.

## Derived Flow Requirements

A derived Flow index must answer:

- Which config/instructions/tools/settings were active when this Pulse happened?
- Which scoped changes were in effect for this step/model call/tool call?
- Which content-bearing Pulses introduced the message/context items used by this model call?
- Which ChangePulses removed or replaced context items before this model call?
- Which relationships are direct facts, and which are derived from graph reconstruction?

These questions are not only display concerns. They determine whether references can replace copied bodies without making runtime reconstruction too expensive or ambiguous.

## PR #20499 Lesson To Carry Forward

The referenced review comment argues against overloading one parent field with multiple meanings.

Pulse should carry that lesson into relationship design:

- avoid one generic parent/config field that means containment, ordering, resume, external bridge, and scoped applicability
- prefer purpose-named relationships when the semantic meaning changes
- keep generic relationships only where the reader does not need stronger semantics

Definition edges are a good test case because `uses_definition` is convenient but may be too vague for common reads.

## Experiment 05 Seed Questions

- Can a run reconstruct active definitions from `uses_*`, `enables_*`, `disables_*`, and ordering edges?
- Should every runtime Pulse emit direct `uses_*` edges, or should readers infer inherited definitions from prior scoped ChangePulses?
- How does the graph represent "tool set changed for the rest of this run" versus "tool set changed for the next step"?
- Can content ownership and context compaction be represented with the same relationship strategy?
- Does a derived Flow index need to materialize definition state at each Pulse boundary?


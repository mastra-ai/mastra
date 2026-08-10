# Pulse Experiment Backlog

This backlog captures proposed fit experiments that should be run after the current notes. Each experiment should follow `fit_exploration_procedure.md` and get its own numbered folder.

## 1. Definition Fit Experiment

Goal: decide how Pulse should represent definitions.

Status: first pass completed in `fit_exploration_04/`.

First-pass result: use referenced definition artifacts/contracts for durable or reusable bodies, ChangePulses for lifecycle/selection/applicability, inline definition bodies for one-off temporary contracts, and purpose-named relationships for runtime use. `DefinitionPulse` should remain a provisional escape hatch rather than a core family member.

Test whether definitions should be:

- separate referenced artifacts
- special Pulse types
- payloads attached to definition-created / definition-updated Pulses

Use concrete examples for both temporary and permanent definition scope.

In this context, temporary versus permanent describes how long the definition applies, not whether it is physically persisted. For example, changing an agent's tool set for the rest of a run is permanent within that run; changing the tool set only for the next step is temporary.

Temporary examples:

- runtime overrides
- generated instructions
- run-local tool schemas
- next-step tool set
- one-call model settings

Permanent examples:

- tool set changed for the remainder of a run
- durable agent config
- published versions
- stored tool definitions
- instruction revisions
- reusable schemas
- model settings revisions

Questions to answer:

- Can runtime Pulses reference definitions without copying instructions, schemas, settings, and configs into every Pulse?
- Does representing definitions as ChangePulses make runtime refs too vague?
- Does representing definitions as separate artifacts violate the "everything observable is a Pulse" premise, or are definitions non-observational referenced bodies?
- How should definition changes represent temporary versus permanent scope?
- Can the next relationship experiment make scoped definition references reconstructable without direct `uses_*` edges on every Pulse?

## 2. Flow / Relationship Graph Experiment

Goal: decide whether `Flow` can be a derived index built from Pulses plus exported relationships.

Status: completed in `fit_exploration_05/`.

Result: Flow should be a derived/materialized read index, not an exported Pulse-like envelope. Export append-only relationships for structural, ordering, lineage/bridge, definition/applicability, and content transformation facts. Keep `parent_of` narrow; use purpose-named edges like `resume_of`, `external_parent`, `thread_contains_flow`, and `previous_flow` where traversal semantics differ.

Reference discussion:

- PR review comment: https://github.com/mastra-ai/mastra/pull/20499#pullrequestreview-4872064274

Why it matters:

- That review argues against overloading one parent field with multiple meanings.
- The concrete tracing problem was that `parentSpanId` had to represent both a normal stored Mastra parent and an ambient external parent, then resume added another parent-like meaning.
- The suggested fix was to split those meanings into purpose-named fields, such as an external parent id and a resume-from id.
- Pulse should apply the same lesson at the model level: relationship edges should describe their purpose directly instead of forcing every connection through one generic parent slot.

Test whether Pulse should avoid both:

- exported Flow envelopes
- embedded relationship fields on every Pulse object

Candidate direction:

- Pulses record moment facts.
- Relationship records connect Pulses into a graph.
- Flow is a derived read/query index over the graph.

Relationship examples to test:

- parent / child
- next sibling
- previous flow in thread
- resume of suspended Pulse
- external parent / bridge correlation
- subagent of parent Pulse
- flow contains Pulse
- thread contains flow
- uses definition

Questions to answer:

- Can a full flow be reconstructed without an exported Flow record?
- Can thread order be reconstructed from `previous_flow` relationships?
- Can message/context order be reconstructed from content-bearing Pulses plus relationships?
- Does exporting relationships instead of embedding links make append-only writes cleaner?
- Do purpose-named relationship types avoid overloaded fields like the `parentSpanId` issue in PR #20499?
- Can the `fit_exploration_04/10-full-scenario.md` definition-reference scenario be represented cleanly with relationship edges?
- Can the relationship graph answer which definitions were active for a Pulse without copying definition refs onto every Pulse?
- What minimal indexes are needed to make graph reads practical?

## 3. Agent Signals Mapping Experiment

Agent Signals needed a deeper source review before choosing a mapping.

Status: completed in `fit_exploration_06/`.

Result: no top-level `Signal` export. Use delivery decision Pulses for routing, content-introducing Pulses when signal bodies enter context, ChangePulses for state-signal tracking and notification record lifecycle, and relationships to connect those facts. Do not emit a generic signal-arrival Pulse by default.

Goal: decide how Agent Signals map into Pulse without duplicating the same fact as both an arrival record and a state-change record.

Questions to answer:

- Should signal handling emit a signal-arrival Pulse, a state-change Pulse, or one Pulse with both arrival and mutation semantics?
- When a signal only informs state, is the arrival itself useful as an observable fact?
- When a signal changes runtime state, should the mutation be a `ChangePulse` that references the arrival Pulse?
- Are there signal types that should be represented only as relationships or definition/config applicability changes?
- Which source paths define Agent Signals semantics today?

## 4. Signal Queue Drain And Abort Follow-Up

Status: completed in `fit_exploration_07/`.

Result: queued Agent Signals need explicit queue/drain facts when delivery and model-context entry are separated. Pre-run signals are folded into the first model request; pending signals become a later model turn and force continuation. Abort signals are not Agent Signals; model abort as run/thread/execution control with request, intent, propagation, observation, and completion facts.

Questions answered:

- Is `signal.delivery_decided: deliver` enough to reconstruct when the model saw a signal?
- Should pre-run and pending signal drains emit different Pulse shapes?
- Is abort a Signal, ChangePulse, Relationship, or something else?
- Which abort facts matter: requested, propagated, observed, completed, or all of them?

## 5. Signal Visibility Reconstruction Follow-Up

Status: completed in `fit_exploration_08/`.

Result: the key unit for reconstruction is model visibility, not signal delivery. For delayed Agent Signals, use `signal.delivery_decided`, `signal_queue.enqueued`, `signal.drained_to_context`, `introduced_content`, and `included_in_model_input`. The drain/content Pulse owns the signal body because MessageList assigns transcript order at context-entry time. Add a derived `model_input` endpoint for prompt-turn reconstruction.

Questions answered:

- What exact facts are needed to know when the model saw a delivered signal?
- Should delayed signal content be owned by delivery or drain/context-entry?
- Are pre-run and pending queue scopes semantically different for replay?
- Can original signal timestamps reconstruct prompt order?

## 6. Branch Refresh Integration Experiment

Status: second pass completed in `fit_exploration_09/`.

Goal: test whether the branch-refresh audit surfaces can fit the current Pulse model without expanding Pulse into a generic product/event bus.

Result: no new top-level export family is needed. Agent Controller/session facts, channel content identity, tool approvals/suspensions, follow-up queues, background task lifecycle tied to tool runs, file-routed definitions/skills, schedule-fired content, and concrete model route/fallback decisions fit the existing Pulse/ChangePulse/Relationship model. Defer experiment/eval export unless needed for launch; skip display mirrors, pubsub mechanics, storage bookkeeping, dataset CRUD, and generated provider registry churn. The second pass produced `fit_exploration_09/08-implementation-handoff.md` with concrete emit/avoid boundaries.

Seed input:

- `code_audit/13-current-branch-refresh.md`

Candidate surfaces:

- Agent Controller and channels
- background tasks
- file-routed agents and skills
- experiments and evals
- dynamic workflows and schedules
- provider/model capability decisions
- abort and Agent Signal facts only where they interact with the new surfaces

Questions to answer:

- Which refreshed surfaces are initial-spec requirements versus later product telemetry?
- Do Agent Controller sessions replace, extend, or merely complement the older Harness runtime candidates?
- Can background task lifecycle fit as tool/run Pulses plus relationships without exporting worker/pubsub plumbing?
- Can file-routed agents and skills reuse the Definition/reference model from `fit_exploration_04/`?
- Do experiments/evals need first-class Pulse families or are they just workflow/scorer/tool compositions?
- What source audit line-level passes must happen before implementation starts?

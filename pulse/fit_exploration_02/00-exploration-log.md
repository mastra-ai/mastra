# Exploration Log

## 2026-06-23 - Scope Refresh And Source Scan

Read:

- `pulse/AGENTS.md`
- `pulse/README.md`
- `pulse/scope-expansion-after-01.md`
- `pulse/fit_exploration_procedure.md`
- `pulse/fit_exploration_01/05-learnings-summary.md`
- `packages/core/AGENTS.md`
- selected `packages/editor/src/namespaces/agent.ts`
- selected Agent Builder/editor files

Assumptions:

- `flow` is the current preferred name for the full Pulse execution graph.
- `action` should be tested as a root-level machine field, not a saved human name.
- Config mutations are in scope when they materially explain later runtime behavior.
- UI clicks and admin navigation are still out of scope.
- Thread order should be explicit across flows, not reconstructed only from timestamps.
- Definition capture should reduce runtime duplication while preserving enough context for learning systems.

Searches run:

- package discovery for Agent Builder, editor, and CMS-like surfaces.
- source search for `agentBuilder`, builder, CMS, stored overrides, tool schemas, thread ids, resource ids, and chunk/span behavior.

Initial findings:

- Agent Builder runtime configuration appears split between `packages/core/agent-builder/ee.d.ts`, `packages/agent-builder/src`, and `packages/editor/src/ee`.
- Agent CMS-like persisted config mutation appears primarily in `packages/editor/src/namespaces/*`, especially `agent.ts`.
- Stored agent config supports creation defaults, stored overrides, version resolution, instruction overrides, tool selection, tool description overrides, model config, processors, workspace, browser, memory, scorers, workflows, and agents.
- Thread context is already broadly present as `threadId` and `resourceId`, but it appears to identify conversation/resource context rather than explicit flow-to-flow order.
- Channel streaming helper code already tracks tool calls by `toolCallId`, which is a good fit for definition/reference separation and lean runtime Pulses.
- Stored agent config is versioned; version rows contain `changedFields`, `changeMessage`, and all snapshot config fields.
- Tool builder execution spans currently repeat `toolDescription` on tool calls, while the builder also has access to richer definition data such as schemas and approval/suspend settings.
- Runtime loop and durable LLM paths already create `MODEL_STEP` and `MODEL_CHUNK` spans through a model span tracker.

Tried:

1. Treating Agent Builder and Agent CMS as separate Pulse surfaces.
   - Result: weak fit.
   - Concern: product-area names hide the domain mutation. `agent_config.tool_added` is more stable than `agent_builder.clicked_add_tool`.

2. Treating stored agent create/update/delete as generic storage CRUD.
   - Result: weak fit.
   - Concern: these are semantically meaningful config provenance events, not storage plumbing.

3. Treating thread id as enough for Pulse flow order.
   - Result: insufficient.
   - Concern: a thread id groups flows but does not preserve turn sequence, retries, regenerations, or branch edits.

Risk noticed:

- Config provenance expands Pulse beyond "execution observability." The better boundary is likely "events that explain execution behavior or learning outcomes."
- If definitions are Pulses, they may look like config events. If definitions are separate records, Pulse stays leaner but needs a reference model.
- `action` must be constrained by surface or it will become a generic event-name string.
- Config mutation flows may be overkill for single version events.

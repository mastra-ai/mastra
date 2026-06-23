# Fit Exploration Procedure

This procedure defines how to run a Pulse fit exploration pass.

The goal is not to design implementation. The goal is to test whether a set of real Mastra events can fit the Pulse model without smuggling spans, logs, metrics, or product telemetry back in under new names.

## When To Run A Fit Exploration

Run a new numbered exploration when any of these change:

- new event families are added to the scope
- new code has landed after a rebase
- the candidate Pulse shape has changed
- a prior exploration surfaced unresolved shape questions
- a product surface needs to be tested against Pulse, such as Agent Builder, Agent CMS, threads, or config revisions

Use numbered folders:

```txt
pulse/fit_exploration_01/
pulse/fit_exploration_02/
pulse/fit_exploration_03/
```

Each folder is a historical snapshot. Do not rewrite old explorations except to fix obvious typos or add explicit reviewed learnings.

## Inputs

Read these before starting:

1. `pulse/AGENTS.md`
2. `pulse/README.md`
3. relevant `pulse/scope-expansion-after-*.md` files
4. the prior exploration's `05-learnings-summary.md`
5. relevant files in `pulse/code_audit/`
6. any newly relevant source files, especially if the branch was rebased

For package source work, follow the local package `AGENTS.md` instructions before inspecting or changing package files.

## Output Files

Use this default file set:

```txt
README.md
00-exploration-log.md
01-shape-fit-rules.md
02-family-fit-matrix.md
03-worked-examples.md
04-open-questions.md
05-learnings-summary.md
```

Additional files are allowed when an exploration needs more structure, for example:

- `06-source-notes.md`
- `07-thread-fit.md`
- `08-config-fit.md`
- `09-definition-fit.md`

Keep the canonical 00-05 files even if some are short. This makes explorations comparable.

## Step 1: Define The Test Boundary

Start by writing `README.md`.

Capture:

- what this exploration is testing
- what changed since the previous exploration
- which source/audit docs are inputs
- which surfaces are in scope
- which surfaces are explicitly out of scope

Be precise about the boundary. Examples:

- runtime-only
- runtime plus config provenance
- threaded flows
- definition-once/reference-many
- Agent Builder and Agent CMS config mutations

Avoid vague scope like "all observability."

## Step 2: Keep A Chronological Exploration Log

Write `00-exploration-log.md` as work happens.

Record:

- files read
- assumptions used
- searches run
- candidates considered
- things tried
- things rejected
- risks noticed
- places where the shape felt strained

This file should preserve the path of reasoning, not only the final answer.

Use this pattern:

```md
## YYYY-MM-DD - Pass Name

Read:

- ...

Assumptions:

- ...

Tried:

1. ...
   - Result: ...
   - Concern: ...

Risk noticed:

- ...
```

## Step 3: State The Shape Rules Being Tested

Write `01-shape-fit-rules.md`.

Do not assume the shape from a prior pass is still correct. Restate the candidate shape for this exploration.

Include:

- candidate Pulse object shape
- field rules
- type/action/surface/primitive rules
- data rules
- relationship rules
- flow/thread rules when relevant
- skip rules

Call out open or experimental fields directly.

Example:

```ts
type Pulse = {
  timestamp: string;
  type: PulseType;
  action?: PulseAction;
  surface?: PulseSurface;
  primitive?: PulsePrimitiveRef;
  level?: PulseLevel;
  text?: string;
  data?: Record<string, number>;
  attributes?: Record<string, unknown>;
  metadata?: Record<string, string>;
  id: {
    flowId: string;
    pulseId: string;
  };
  links: PulseLinks;
};
```

Devil's advocate requirement: include at least one paragraph on where the candidate shape may be wrong.

## Step 4: Classify Event Families

Write `02-family-fit-matrix.md`.

Group raw events into families before writing examples. Avoid one row per tiny call site unless the distinction matters.

Suggested columns:

| Family | Source | Surface | Primitive Fit | Suggested Type | Suggested Action | Shape Notes | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |

Verdicts should be constrained:

- `Apply`
- `Apply selectively`
- `Apply at caller`
- `Config provenance`
- `Reference only`
- `Defer`
- `Skip`

Use `Skip` for admin/query/storage plumbing that does not explain runtime behavior or learning outcomes.

Use `Config provenance` for committed changes to agent/tool/workflow/eval/config state.

Use `Reference only` for data better captured once as a definition or revision, then referenced by runtime Pulses.

## Step 5: Work Concrete Examples

Write `03-worked-examples.md`.

For each important family, produce actual Pulse-shaped examples.

Examples should cover:

- a normal path
- an error or rejection path
- at least one linked sequence
- at least one case that should not emit a Pulse
- at least one case where definition/config data is referenced instead of duplicated

Prefer realistic but compact objects. Avoid full production payloads unless the payload shape is the point being tested.

Every example should include a short observation:

```md
Observation:

- This fits because ...
- This is weak because ...
- This suggests ...
```

## Step 6: Capture Open Questions And Learnings

Write `04-open-questions.md` before writing the final summary.

Questions should be grouped by category:

- shape
- identity and flow
- threads
- configuration provenance
- data and payloads
- source coverage
- deferred implementation

Then write `05-learnings-summary.md`.

The summary should include:

- decisions confirmed
- decisions weakened or reversed
- shape changes to explore next
- scope changes
- terminology changes
- risks
- candidate shape after the pass

Do not hide disagreements or uncertainty. If a field only works because examples are easy, say so.

## Step 7: Update Shared Docs Sparingly

Only update `pulse/README.md` or `pulse/scope-expansion-after-*.md` when a learning affects the shared concept.

Good shared-doc updates:

- `flow` replaces `trace` as preferred term
- config provenance is now in Pulse scope
- thread flow links are a core concept

Bad shared-doc updates:

- every temporary example from one exploration
- unresolved alternatives that only appeared once
- implementation details before shape fit is clear

## Exploration Quality Bar

A good fit exploration:

- documents what was read and tried
- uses real source/audit candidates
- preserves rejected approaches
- distinguishes runtime execution from config provenance
- avoids turning every storage/admin/UI event into Pulse
- tests lean parent/child behavior
- tests flow-level relationships separately from Pulse-level links
- produces examples concrete enough to critique
- ends with a short learning summary

A weak fit exploration:

- only restates the desired model
- does not test real events
- treats Pulse as renamed spans
- emits Pulses for every internal operation
- uses free-form names everywhere without checking machine use
- avoids open questions

## Suggested Setup For `fit_exploration_02`

Initial scope to test:

- runtime events from the refreshed codebase after rebase
- configuration provenance from Agent Builder and Agent CMS
- definition-once/reference-many for tool definitions
- thread-to-thread flow links for conversational agents

Expected extra files:

```txt
06-source-refresh-notes.md
07-config-provenance-fit.md
08-definition-reference-fit.md
09-thread-flow-fit.md
```

These can be folded back into the canonical files if the exploration stays small.

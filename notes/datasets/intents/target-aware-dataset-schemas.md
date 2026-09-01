# Intent: Target-Aware Dataset Schemas + Form/JSON Item Editor

> **Status:** Intent (requirements + architecture). No implementation prescribed.
> **Audience:** Implementer with no prior context on this feature.
> **Scope:** Studio (playground) UI only. No backend changes required.

---

## 1. Problem

A **dataset** in Mastra is a collection of **items** used to run **experiments** against a
**target** — an agent, a workflow, or a scorer. Each item carries an `input` (and optionally
`requestContext`, `groundTruth`, etc.). When an experiment runs, the executor feeds each
item's `input` straight into the target:

- agent target → `agent.generate(item.input)`
- workflow target → `workflow.start({ inputData: item.input })`
- scorer target → `scorer.run(item.input)`

Two gaps make this hard to use in Studio today:

1. **Datasets are not target-aware in the UI.** Although the backend can store a dataset's
   `targetType` / `targetIds`, the Create/Edit dataset dialogs give the user no way to pick a
   specific target entity. As a result the dataset never "knows" what shape its items should be,
   and its `inputSchema` / `requestContextSchema` are left empty unless typed by hand.

2. **Item authoring is raw-JSON-only.** Adding or editing an item means writing JSON by hand for
   every field, including `input` and `requestContext`. There is no schema-driven form, no field
   validation, and no guidance — even when the shape is fully knowable from the target.

The result: authoring dataset items is error-prone, and the schema information the system already
has access to is not surfaced to the user.

---

## 2. Goal

Let a user **attach a target** (agent / workflow / scorer) to a dataset, **auto-derive the
dataset's schemas** from that target, and use those schemas to offer **form-based editing** of
item `input` and `requestContext` — while **always** keeping raw JSON available as a lossless
fallback.

Non-goal: changing how experiments run, how datasets are stored, or any backend contract.

---

## 3. Background: what already exists (clean baseline)

The implementer should not assume this is greenfield on the backend. The following are already
true and must be **reused, not rebuilt**.

### 3.1 Backend already persists target + schema fields

The dataset create/update API already accepts and stores:

- `targetType?: string` — e.g. `"agent" | "workflow" | "scorer"` (string, not enum-restricted)
- `targetIds?: string[]` — IDs of the attached target entities
- `scorerIds?: string[]`
- `inputSchema`, `groundTruthSchema`, `requestContextSchema` — JSON Schema objects

These flow through: **core dataset manager → server handler/schema → client SDK params**.
**No backend, handler, or SDK change is required** to set a target or persist schemas.

> Note: the *experiment trigger* endpoint restricts `targetType` to an enum
> (`agent | workflow | scorer`, and in one place `+ processor`). Dataset create/update does
> **not**. The dataset feature should align on **agent / workflow / scorer** for schema
> derivation. `processor` has no schema source and is out of scope (see §7).

### 3.2 Schemas are discoverable per target type

- **Workflow** → real, per-workflow `inputSchema` / `outputSchema` are fetchable from the
  workflow's schema/details. The workflow's `requestContextSchema` is also exposed (serialized
  JSON string).
- **Agent** → there is **no per-agent input schema**. Agents accept a universal "message list"
  input. Use a **static default input/output schema** (the existing agent-schema source). The
  agent's `requestContextSchema` **is** real and per-agent (serialized JSON string from agent
  details).
- **Scorer** → use the existing **static scorer schema** variants. Scorers have no request
  context.

### 3.3 A proven JSON-Schema → form pipeline exists

The playground already converts JSON Schema into a rendered form elsewhere (the workflow trigger
form and the experiment-trigger request-context form). The pipeline is:

`JSON Schema → zod → dynamic form renderer`

This same pipeline must back the new item editor. Do not invent a second form system.

### 3.4 The executor consumes `item.input` directly

Whatever the form produces for `input` is handed to the target **as-is**. The form's job is to
produce exactly the object the target expects — not a wrapper or envelope.

---

## 4. Requirements

Requirements are normative. "MUST" = required; "SHOULD" = strong default; "MAY" = optional.

### 4.1 Dataset target selection (Create + Edit dialogs)

- R1. The Create and Edit dataset dialogs MUST let the user choose a **target type**
  (agent / workflow / scorer) and then pick a **specific target entity** of that type.
- R2. The selected target MUST persist as `targetType` + `targetIds` via the existing
  create/update API. (Single target entity is sufficient; the field is an array for forward
  compatibility.)
- R3. Existing datasets that already have a target MUST display that target as pre-selected when
  the Edit dialog opens.
- R4. Changing or clearing the target MUST persist on save like any other field.

### 4.2 Schema auto-fill from target

- R5. When a target entity is selected, the dialog MUST populate the dataset's `inputSchema`,
  `outputSchema`, and `requestContextSchema` from that target per §3.2.
- R6. Auto-fill is a **starting point**. It MUST NOT silently overwrite a schema the user has
  hand-edited. (Acceptable strategies: only fill empty schemas, only re-fill when the target
  selection actually changes, or prompt. The chosen rule must be deterministic and documented.)
- R7. On opening the Edit dialog for a dataset that already has saved schemas, auto-fill MUST NOT
  clobber the persisted schemas on first render.
- R8. For target types with no derivable schema (e.g. `processor`), the dialog MUST degrade
  gracefully: no auto-fill, manual schema entry still available.

### 4.3 Form/JSON item editor (Add + Edit item)

- R9. When the dataset has a schema for a field (`input`, `requestContext`), the Add/Edit item
  editor MUST offer a **Form** view (schema-driven) for that field, defaulting to Form when a
  usable schema exists.
- R10. Every schema-backed field MUST also offer a **JSON** view. Fields with **no** schema
  (`groundTruth`, `expectedTrajectory`, `metadata`, etc.) MUST remain JSON-only.
- R11. Switching between Form and JSON MUST be **lossless**:
  - Form → JSON serializes the current object to readable JSON.
  - JSON → Form hydrates the form **only if** the JSON parses and validates against the schema.
  - If the JSON is invalid or not representable in the form, switching to Form MUST be
    **disabled** (with a hint), and the user's JSON text MUST be preserved. JSON is never
    discarded silently.
- R12. The value submitted MUST be identical regardless of which view authored it — both views
  resolve to the same parsed object handed to the existing add/update item mutation.
- R13. Server-side validation errors on submit MUST continue to surface through the existing
  error-display path (no regression).

### 4.4 Consistency / cleanup

- R14. The duplicated notions of "dataset target type" across the UI MUST be reconciled into a
  single source of truth that the dialogs, the target picker, and the schema-derivation logic all
  consume. `processor` MUST be represented but explicitly marked as schema-unsupported.

### 4.5 Quality gates

- R15. Typecheck, the package test suite, and the build MUST pass.
- R16. New behavior MUST be covered by tests using the package's required testing strategy
  (Vitest + MSW + typed client-SDK fixtures, driving the real client + query stack). Tests MUST
  NOT mock the app's own data hooks/services and MUST NOT use untyped fixtures or unsafe casts.

---

## 5. Architecture

This is the intended shape of the solution. The implementer chooses exact file/component names.

### 5.1 Layers

```
┌──────────────────────────────────────────────────────────────┐
│ Create / Edit Dataset dialog                                 │
│  ├─ Target type select  ─┐                                   │
│  ├─ Target entity picker ┘→ (targetType, targetId)           │
│  └─ Schema config section                                    │
│        ▲ auto-fills from target                              │
└────────┼─────────────────────────────────────────────────────┘
         │ (targetType, targetId)
         ▼
┌──────────────────────────────────────────────────────────────┐
│ Target → schema resolver (hook)                              │
│  agent   → static input/output + agent requestContextSchema  │
│  workflow→ real input/output + workflow requestContextSchema │
│  scorer  → static scorer variant, no request context         │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ Add / Edit item dialog                                       │
│  per field:  Form ⇆ JSON toggle (schema-or-json field)       │
│     Form  → JSON Schema → zod → dynamic form                 │
│     JSON  → existing code editor                             │
│  canonical value = parsed JS object (what submit expects)    │
└──────────────────────────────────────────────────────────────┘
```

### 5.2 Key components (conceptual)

1. **Target entity picker** — given a `targetType`, loads the matching entity list
   (agents / workflows / scorers) and lets the user pick one. Mirror the existing
   experiment-trigger target selector so list-loading behavior stays consistent. Output:
   `targetId`. The dialog derives `targetIds = [targetId]`.

2. **Target → schema resolver** — a single hook that, given `(targetType, targetId)`, returns
   `{ inputSchema, outputSchema, requestContextSchema }` per §3.2. It:
   - performs network fetches only for agent/workflow (workflow schema + details; agent details),
   - returns static schemas for agent input/output and scorer synchronously,
   - returns nulls until async data resolves.
   This is the **single place** that knows how each target type maps to schemas.

3. **Schema config section** — consumes the resolver's output and writes into the dataset's
   schema fields, honoring the non-clobber rules (R6, R7). It remains the home for manual schema
   editing when there is no target.

4. **Schema-or-JSON field** — a reusable controlled field used by the item editors. Props
   conceptually: `label`, optional `schema`, `value` (canonical object/serialized form),
   `onChange`, validation errors. It owns the Form⇆JSON toggle and the lossless rules (R11). When
   no schema is provided, it renders JSON-only.

### 5.3 Canonical value & loss-prevention

- The **canonical representation** of a field value is the parsed object the submit path already
  expects. Both Form and JSON views read/write that same value.
- Loss prevention is the central design constraint:
  - Initial mount with an unparseable seed value → start in JSON (never drop text).
  - Schema arriving asynchronously after mount (dataset loads via query) → may switch a field to
    Form **only if** the user hasn't manually chosen a view and the current value is valid.
  - JSON → Form is gated on parse + validate; otherwise the toggle to Form is disabled.

### 5.4 Source-of-truth for target types

A single module enumerates dataset target types and which ones support schema derivation. The
dialogs, the entity picker, and the resolver import from it. `processor` is present but flagged
`schemaSupported: false`.

---

## 6. Acceptance criteria

A reviewer should be able to verify each of these by hand or via tests:

- AC1. Create a dataset, choose target type = workflow, pick a workflow → the dataset's input and
  request-context schemas auto-populate from that workflow; saving persists `targetType` +
  `targetIds`.
- AC2. Repeat with target type = agent → input/output use the static agent schema; request context
  uses the agent's own `requestContextSchema`; JSON fallback is available.
- AC3. Repeat with target type = scorer → static scorer schema fills; no request-context schema.
- AC4. Open Edit on a dataset that already has a target and hand-edited schemas → the saved schemas
  are shown unchanged (no clobber); changing the target re-derives schemas.
- AC5. Add an item to a dataset with an input schema → the input field defaults to a Form;
  submitting sends the correct parsed `input`.
- AC6. Toggle that field Form → JSON → Form with valid content → no data loss; values round-trip.
- AC7. Put invalid JSON in a field → switching to Form is disabled and the text is preserved.
- AC8. A field with no schema (e.g. metadata) shows JSON only, with no Form toggle.
- AC9. A server validation error on item submit still surfaces in the UI.
- AC10. Typecheck, tests, and build all pass; new tests cover AC1–AC9 via the required MSW strategy.

---

## 7. Out of scope (follow-ups)

- **Per-agent "messages" input editor.** Agents use the static default input schema for now; a
  bespoke message-list editor is a later phase.
- **Tool mocks.** Letting users supply tool mocks via a form (instead of JSON) is feasible on the
  UI side eventually, but requires **new backend work** (a persisted field on the dataset/
  experiment record, handler + SDK params, and experiment-executor support to apply mocks at run
  time). Not part of this feature.
- **`processor` target type schema derivation.** No schema source exists today; represented but
  unsupported.

---

## 8. Risks & constraints

- **Nested forms.** The dynamic form renderer emits its own `<form>`. If an item or dataset dialog
  also wraps content in a `<form>` with a submit button, the result is an invalid nested form that
  can swallow the dialog's submit. The implementer MUST ensure schema-driven form fields are not
  rendered inside another `<form>` that owns the dialog's submit (use a non-form container +
  explicit submit handler, or otherwise guarantee a single form boundary). Tests SHOULD assert the
  dialog actually submits when a schema-driven field is present.
- **Async schema timing.** Dataset schema arrives via query after first render; the editor must not
  lock into the wrong view or lose seed content during that window (§5.3).
- **Serialized vs parsed schemas.** Agent/workflow `requestContextSchema` arrives as a serialized
  JSON string; dataset storage uses parsed objects. Parsing must be defensive (invalid string →
  treat as no schema, never throw).

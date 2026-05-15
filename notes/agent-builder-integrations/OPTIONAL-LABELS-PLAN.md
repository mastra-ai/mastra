# Plan — Optional Connection Labels (single-connection case)

## Overview

Today every `Connection` requires a non-empty, unique, ≤32 char `label`. For the common case of one connection per `toolService`, that label is noise — the picker still forces the user to type one, and the LLM sees no suffix anyway (runtime already sets `skipSuffix = connections.length === 1`).

Goal: make `label` **optional when there is exactly one connection** for a given `toolService`. As soon as a second connection is added, both must have non-empty, unique labels.

Storage shape stays additive: `label` becomes `string | undefined` in TypeScript and `optional()` in Zod. No migration required for existing rows (all current rows already carry a label).

---

## Files Touched

### Core

- `packages/core/src/tool-integration/tool-integration.ts`
  - `Connection.label?: string` (was required).
  - Update doc comment: "Required when ≥2 connections share a `toolService`."
- `packages/core/src/tool-integration/runtime.ts`
  - `buildConnectionSuffix` already handles empty input via `'CONN'` fallback. No behavior change in single-conn path because `skipSuffix` is already true.
  - Multi-conn path: keep current behavior — labels are required at validation time, so missing label here is a programmer/server bug; let `buildConnectionSuffix` fall back to `'CONN'` defensively.

### Server

- `packages/server/src/server/schemas/tool-integrations.ts`
  - Make `label` optional on the `ConnectionSchema`.
  - Replace label-uniqueness `superRefine` with combined check:
    1. If `connections.length >= 2` for a service: every entry must have non-empty trimmed label, **and** labels must be unique case-insensitively.
    2. If `connections.length === 1`: skip both checks.
  - Keep label format constraints (≤32 chars, regex) when present.

### Playground — schemas

- `packages/playground/src/domains/agent-builder/schemas/edit-form.ts`
  - Mirror the server rule: `label` optional, but required + unique once `connections.length >= 2`.

### Playground — mappers

- `packages/playground/src/domains/agent-builder/mappers/form-values-to-save-params.ts`
  - Pass label through unchanged; drop empty/whitespace-only labels (write `undefined`) when single connection.
- `packages/playground/src/domains/agent-builder/mappers/stored-agent-to-form-values.ts`
  - Tolerate missing `label` (default to `''` in form state so input renders empty).

### Playground — picker

- `packages/playground/src/domains/tool-integrations/components/connection-picker.tsx`
  - Hide the per-row label input when there is **exactly one** connection on this `toolService`. Show a small caption: "Add another to enable labels."
  - Remove "Label is required" from the OAuth/existing add path when this would be the first connection.
  - When the user clicks "Connect" / "Pin" while a connection already exists (i.e. about to become the 2nd):
    - Force-show label inputs for **all** connections.
    - Block the Add/Pin until every connection has a non-empty, unique label.
  - Validation helper updated: `requireLabels = connections.length >= (isAddingNew ? 1 : 2)`.

### Tests

- `packages/core/src/tool-integration/runtime.test.ts` — add case: single conn with `label: undefined` resolves cleanly with no suffix.
- `packages/server/src/server/schemas/tool-integrations.test.ts` — single conn without label OK; two conns without labels rejected; two conns with duplicate labels rejected.
- `packages/playground/src/domains/agent-builder/__tests__/schemas.test.ts` — mirror server cases.
- `packages/playground/src/domains/agent-builder/mappers/__tests__/*.test.ts` — round-trip a single unlabeled conn.
- `packages/playground/src/domains/tool-integrations/components/connection-picker.test.tsx`:
  - Adding first connection: no label input, button enabled.
  - Adding second connection: label inputs appear on both rows, Pin disabled until labels filled and unique.
  - Removing the second connection: label inputs disappear again (or stay — see Decision below).

---

## Decision Points (resolved with sensible defaults)

1. **Should the existing label persist when going from 2→1?**
   Yes. Storage tolerates it; we just stop requiring it. The input simply hides.
2. **What if a user types a label, then removes the second connection?**
   Keep the typed label in storage. Hidden but valid.
3. **Suffix routing hint in description?**
   Already gated by `skipSuffix`. No change.

---

## Steps

1. Core: relax `Connection.label` typing + doc.
2. Server schema: optional label + new conditional refinement; tests.
3. Playground schema: mirror; tests.
4. Mappers: tolerate missing label on read/write; tests.
5. `ConnectionPicker`: conditional label inputs + validation; tests.
6. Build all touched packages, run targeted suites.
7. Smoke in dev: add gmail with no label → save → re-open → still no label → add second → both inputs appear.

---

## Verification

- `pnpm --filter @mastra/core test src/tool-integration`
- `pnpm --filter @mastra/server test src/server/schemas src/server/handlers/tool-integrations.test.ts`
- `pnpm --filter @mastra/playground test src/domains/agent-builder src/domains/tool-integrations`
- `pnpm --filter @mastra/core build && pnpm --filter @mastra/server build && pnpm --filter @mastra/playground build`
- Manual: confirm LLM still sees plain `GMAIL_FETCH_EMAILS` in single-conn case (existing behavior, regression check).

---

## Estimate

- ~150 LOC + tests.
- 1 commit.
- ~1.5 hours including verification.

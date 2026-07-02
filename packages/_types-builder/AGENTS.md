# @internal/types-builder

Builds published `.d.ts` output for packages that bundle `@internal/*` (and other) type dependencies. `generateTypes()` compiles declarations, inlines bundled package types into `dist/_types/`, and validates that declaration imports only reference runtime dependencies or bundled packages.

Test: pnpm --filter @internal/types-builder test

## Boundary rule: bundled types must be structural

Bundled declaration files are **copies** — multiple published packages ship their own duplicate of the same `@internal/*` declaration (e.g. `@mastra/core` and every auth provider each embed `MastraAuthProvider`/`MastraBase`). TypeScript checks `#private` and `protected` members **nominally**, so two identical copies with those members are mutually unassignable. This broke `server.auth = new MastraAuthWorkos()` in userland (#18682).

Rules:

- Types that cross a published package boundary via `@internal/*` bundling must be **structural**. Do not rely on `#private` fields, `protected` members, or `instanceof` checks for identity across the boundary — use structural interfaces (e.g. `IMastraAuthProvider`) and duck-typing.
- As a mechanical safety net, `replace-types.js` strips nominal brands (`#private;`, `private`/`protected` members) from every class in copied declaration files (`stripNominalBrands`). Do not remove this; it keeps all current and future `@internal/*` extractions structurally safe. Constructors keep their visibility (it affects `new` calls, not instance assignability).
- Regression coverage lives in `src/replace-types.test.js` (emitted copies are brand-free), `packages/core/src/server/server.test-d.ts` (interface assignability), and `e2e-tests/type-check/template/core/auth.test-d.ts` (packed artifacts under `exactOptionalPropertyTypes`).

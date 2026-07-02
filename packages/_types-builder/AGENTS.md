# @internal/types-builder

Builds published `.d.ts` output for packages that bundle `@internal/*` (and other) type dependencies. `generateTypes()` compiles declarations, inlines bundled package types into `dist/_types/`, and validates that declaration imports only reference runtime dependencies or bundled packages.

## Boundary rule: bundled types must be structural

Bundled declaration files are **copies** — multiple published packages ship their own duplicate of the same `@internal/*` declaration (e.g. `@mastra/core` and every auth provider each embed `MastraAuthProvider`/`MastraBase`). TypeScript checks `#private` and `protected` members **nominally**, so two identical copies with those members are mutually unassignable. This broke `server.auth = new MastraAuthWorkos()` in userland (#18682).

Rules:

- Types that cross a published package boundary via `@internal/*` bundling must be **structural**. Do not rely on `#private` fields, `protected` members, or `instanceof` checks for identity across the boundary — expose structural interfaces (e.g. `IMastraAuthProvider`) at public contract points and use duck-typing at runtime.
- The bundled class declarations themselves keep their brands, so a nominal class type (e.g. `MastraAuthProvider`) must never appear in a position that receives instances from another published package. Accept the structural interface instead, and have the class declare `implements` on it so the compiler keeps the two in sync.
- Regression coverage lives in `packages/core/src/server/server.test-d.ts` (interface assignability, including a simulated bundled duplicate copy) and `e2e-tests/type-check/template/core/auth.test-d.ts` (packed artifacts under `exactOptionalPropertyTypes`).

# Coding Standards — Mastra Software Factory

These apply to `mastracode/factory` (`@mastra/factory`) on top of the root Mastra pnpm-workspace/TypeScript conventions (see the root `AGENTS.md`).

## Package shape

- Strict TypeScript throughout (`tsc --noEmit` via `pnpm --filter @mastra/factory check`). `eslint.config.js` disables the type-checked rule set for `**/*.ts?(x)` — lint (`oxlint` + `eslint`) is fast and non-type-aware; correctness comes from `check`, not lint.
- Tests are colocated: `foo.ts` next to `foo.test.ts`. `vitest.config.ts` runs `src/**/*.test.ts` under one project named `unit:mastra-factory`.
- Public API is re-exported only from `src/index.ts`; subpath exports (`./boards`, `./*`) map 1:1 to `dist/*` — do not add new public surface without adding it there and to `package.json#exports`.

## Storage domains

- One class per bounded concern, extending `FactoryStorageDomain`, each with its own `CollectionSchema` constant (`FOO_SCHEMA`) and a `toFoo(row: FooDbRow): Foo` conversion function that maps `snake_case` DB columns to `camelCase` domain types. Never leak `*DbRow` shapes past the domain class.
- Per the root convention: put deterministic input/output constraints (shape, types, ranges, formats, cross-field invariants) in Zod schemas; keep runtime/external checks (authorization, existence, conflicts, external API responses) in the method body (`execute`-equivalent).
- Schema/columns follow existing naming: `org_id` first for tenant scope, then `factory_project_id` when project-scoped, timestamps as `created_at`/`updated_at`, booleans with explicit `default`.
- Additive migrations only — a schema change adds nullable columns or new indexes; it does not rename or repurpose an existing column in place (see `CHANGELOG.md` migration notes for the established pattern).

## Boards

- Define boards only through `defineBoard()` — never construct a `BoardDefinition` object literal directly; the validation (`validateBoardIdentifier`, `validatePhaseSemantics`, `validateToolRules`) is the enforcement point for the phase-kind/role/initialPhase invariants (see `business-rules.md` #10–13).
- Every phase declares `kind` explicitly; every working phase declares `role`; never rely on a default.
- A board's `transitionPolicy`, lifecycle rules, and tool rules are declared inline on the board — do not add a second registration path (e.g. a side-table of handlers keyed by board id) that a reader wouldn't find by reading the `defineBoard()` call.
- Rule handlers return exactly one of the documented decision shapes or `undefined` — never `null`, never a bare string.

## Rules and context types

- `rules/types.ts` is the shared vocabulary (`FactoryRuleActor`, `FactoryRuleItemContext`, `FactoryBoundRuleContext`, etc.) — extend it rather than inventing a parallel shape in a board file.
- Every committed rule evaluation carries `configVersion` and a `causalChain` capped at `MAX_FACTORY_RULE_CAUSAL_DEPTH` — when adding a new rule-producing code path, thread both through; do not synthesize a decision without a causal entry pointing at the ingress that produced it.
- Idempotency is by `ingress` identity — a rule evaluation path must be safe to re-run with the same ingress (webhook redelivery, dispatcher retry) without double-acting.

## Integrations

- Implement `FactoryIntegration` fully; read credentials once in the constructor from explicit args the host passes — never read `process.env` inside factory or integration library code outside the host's deploy-entry construction site.
- An integration must degrade to "not configured" (routes don't mount, tools don't register) rather than throwing, when it is simply absent from `MastraFactoryConfig.integrations`.
- Capability interfaces (`capabilities/intake.ts`, `capabilities/version-control.ts`) are the seam a new integration implements to plug into board rules — prefer extending a capability interface over adding integration-specific branches in board/rule code.

## General style (inherited, restated for this package)

- No unrequested refactors, no speculative abstractions — three similar domain classes is fine; a generic `Domain<T>` base beyond what `FactoryStorageDomain` already provides is not, unless three+ domains need the exact same behavior today.
- Comments explain *why*, matching the file-header-comment style already used throughout (`auth.ts`, `dispatcher.ts`, `documents/base.ts`) — don't restate what the code already says.
- Error handling: validate at the boundary (route body/path/query schemas, rule decision schemas) and trust internal callers past that boundary.

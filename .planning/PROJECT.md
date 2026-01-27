# Fix RequestContext Type Variance

## What This Is

A TypeScript type fix for the Mastra framework that resolves a type variance issue preventing users from passing typed `RequestContext<T>` instances to agent and workflow methods.

## Core Value

Users can pass typed RequestContext instances to framework methods without TypeScript compilation errors.

## Requirements

### Validated

- ✓ RequestContext class supports generic type parameter for type-safe value storage — existing
- ✓ Agents accept requestContext parameter for request-scoped configuration — existing
- ✓ Workflows accept requestContext parameter for request-scoped configuration — existing
- ✓ Framework treats RequestContext as opaque pass-through (no internal type inspection) — existing

### Active

- [ ] Users can pass `RequestContext<MyType>` to agent.generate() without type errors
- [ ] Users can pass `RequestContext<MyType>` to agent.stream() without type errors
- [ ] Users can pass `RequestContext<MyType>` to workflow.stream() without type errors
- [ ] Users can pass `RequestContext<MyType>` to workflow.execute() without type errors
- [ ] Type system accepts any typed RequestContext variant as valid input

### Out of Scope

- Changes outside packages/core — other packages not affected by this issue
- Documentation updates — not required for this patch
- Runtime behavior changes — this is purely a type-level fix
- API surface changes — no new methods or parameters
- Breaking changes — must remain backward compatible (patch release)
- Other RequestContext issues — focused solely on type variance problem

## Context

**Issue:** GitHub #12182 reports TypeScript error when passing `RequestContext<EnvironmentSettingsContext>` to workflow.stream() or agent methods.

**Root cause:** TypeScript generics are invariant by default. Methods currently typed as accepting `requestContext: RequestContext` default to `RequestContext<unknown>`, which cannot accept `RequestContext<SpecificType>`.

**User impact:** Users creating typed contexts for compile-time safety hit type errors despite correct runtime behavior. Minimal reproduction example exists at https://github.com/jksaunders/mastra-request-context-issue/

**Technical environment:**
- TypeScript 5.9.3 in strict mode
- Mastra v1 already released (requires backward-compatible patch)
- Monorepo structure with packages/core containing type definitions
- Framework uses RequestContext as opaque container (no internal type inspection)

## Constraints

- **Scope**: Only modify packages/core — no changes to other packages
- **Compatibility**: Must be backward compatible (patch release, not breaking change)
- **Timeline**: Quick fix needed — users blocked on v1 adoption
- **Tech stack**: TypeScript type system only — no runtime changes

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Use function overloads (not simple `any`) | Provides maximum type safety while solving variance issue. Overload 1 accepts typed contexts, overload 2 preserves existing behavior, implementation uses `any`. Follows Express/Fastify pattern. | ✓ Approved |
| Patch release scope | Type-only change with full backward compatibility. Overload 2 explicitly preserves existing signatures. No runtime changes. | — Pending |
| Focus on core package only | Issue manifests in core type definitions. Other packages inherit these types. | — Pending |
| Apply pattern consistently | All methods accepting requestContext (generate, stream, text, streamText, streamObject, getMemory, etc.) use same overload pattern for consistency. | — Pending |

---
*Last updated: 2026-01-27 after initialization*

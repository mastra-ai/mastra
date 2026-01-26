# Evented Workflow Runtime Parity

## What This Is

Bring the evented workflow runtime to full feature parity with the default workflow runtime. The evented runtime supports event-driven orchestration, distributed execution, and real-time streaming, but has fallen behind on core workflow features. This project closes those gaps.

## Core Value

The evented runtime must pass the same test suite as the default runtime — tests are the specification for parity.

## Requirements

### Validated

<!-- Inferred from existing codebase -->

- ✓ Basic workflow execution — existing
- ✓ Step-based execution model — existing
- ✓ Event-driven architecture with pub/sub — existing
- ✓ ExecutionEngine abstraction — existing
- ✓ Storage integration for workflow state — existing

### Active

<!-- To be discovered through gap analysis -->

- [ ] All default runtime features (TBD after analysis)
- [ ] Pass default runtime test suite on evented runtime

### Out of Scope

- Inngest runtime parity — default runtime is the reference
- New features beyond default runtime — parity only, no additions
- Performance optimization — correctness first

## Context

**Codebase state:**

- Mastra monorepo with TypeScript (strict mode)
- Workflow layer: `packages/core/src/workflows/`
- ExecutionEngine handles step graph processing
- Steps can suspend/resume (human-in-the-loop)
- Events published via pub/sub for monitoring
- Multiple runtimes exist: default, inngest, evented

**Technical environment:**

- Node.js >= 22.13.0
- Vitest for testing
- TypeScript 5.9.3
- pnpm workspace monorepo

**Validation approach:**

- Default runtime's test suite is the specification
- Evented runtime passes when tests pass

## Constraints

- **Runtime compatibility**: Evented runtime must maintain its event-driven, distributed, streaming characteristics while achieving parity
- **Test-driven**: Features are complete when tests pass, not when code looks similar
- **No regressions**: Existing evented runtime functionality must continue working

## Key Decisions

| Decision                     | Rationale                                   | Outcome   |
| ---------------------------- | ------------------------------------------- | --------- |
| Default runtime as reference | User preference, simpler than union of both | — Pending |
| Test suite as specification  | Objective measure of parity                 | — Pending |

---

_Last updated: 2026-01-26 after initialization_

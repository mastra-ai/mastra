# Mastra Datasets

## What This Is

A datasets feature for Mastra that enables systematic evaluation of AI agents and workflows. Users create collections of test cases, run them against targets (agents, workflows), apply scorers, and compare runs to detect regressions. Works in both UI (playground) and CI pipelines.

## Core Value

Catch quality regressions before they reach users — when you modify a prompt or model, know immediately if scores dropped.

## Requirements

### Validated

- ✓ Agent system with generate/stream execution — existing
- ✓ Workflow engine with step-based execution — existing
- ✓ Storage layer with pluggable backends and domain interfaces — existing
- ✓ Evals/scorers system for quality measurement — existing
- ✓ Playground UI for development — existing
- ✓ Request context for auth/threading — existing

### Active

- [ ] Create and manage datasets with test cases
- [ ] Dataset versioning (auto-version on item changes)
- [ ] Test cases with input, optional expected output, context
- [ ] Run datasets against targets (agents, workflows)
- [ ] Apply scorers to run results (separate from target's built-in scorers)
- [ ] Human evaluation flow (run without scorers, review outputs)
- [ ] Compare runs to detect score regressions
- [ ] Cross-version comparison with clear surfacing of changes
- [ ] Bulk import test cases from CSV
- [ ] New storage domain for datasets, runs, results
- [ ] Playground UI: datasets page, dataset detail, run triggering, results view
- [ ] CI integration for automated evaluation

### Out of Scope

- Real-time collaboration on datasets — complexity not justified for v1
- Dataset sharing/marketplace — focus on single-team use first
- Auto-generated test cases from production traffic — future enhancement

## Context

**Existing infrastructure to leverage:**
- Storage domain pattern (workflows, memory, scores) — add datasets domain
- Evals package with scorer interface — reuse for dataset scoring
- Playground UI patterns — extend for datasets pages
- Request context — pass through to dataset runs

**Prior art to research:**
- Langfuse datasets feature
- Braintrust evaluation system
- LangSmith datasets

**User workflow:**
1. Create dataset from sidebar in playground
2. Add items manually or import from CSV
3. Click "Run" → select target + optional scorers
4. Watch results stream in with pass/fail status
5. After changes, run again and compare

## Constraints

- **Tech stack**: TypeScript, existing Mastra patterns, Zod for schemas
- **Storage**: Must work with all existing storage backends (pg, libsql, etc.)
- **UI**: Integrate into existing playground, follow established patterns
- **Backward compatibility**: Don't break existing evals/scorers API

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| New storage domain for datasets | Follows existing pattern (workflows, memory, scores) | — Pending |
| Scorers passed to run, not inherited from target | Separates concerns, allows different scoring per experiment | — Pending |
| Runs persist forever | Simplifies v1, can add cleanup later | — Pending |
| Allow cross-version comparison with clear warnings | Real use case (added edge cases), but surface caveats | — Pending |

---
*Last updated: 2026-01-23 after initialization*

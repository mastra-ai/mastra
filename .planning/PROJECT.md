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

**Data Layer:**
- [ ] Create and manage datasets with test cases
- [ ] Dataset versioning (auto-version on item changes)
- [ ] Test cases with input, optional expected output, context
- [ ] Optional schema validation (JSON Schema for input/expectedOutput)
- [ ] New storage domain for datasets, runs, results

**Execution Layer:**
- [ ] Run datasets against targets (agents, workflows, scorers, processors)
- [ ] Apply scorers to run results (separate from target's built-in scorers)
- [ ] Item selection for runs (run subset via `itemIds[]` param)
- [ ] Human evaluation flow (run without scorers, review outputs)
- [ ] Run status tracking (pending/running/completed/failed)

**Analysis Layer:**
- [ ] Compare runs to detect score regressions
- [ ] Cross-version comparison with clear surfacing of changes
- [ ] Run analytics (success rate, avg scores, latency distribution)

**Integration:**
- [ ] Bulk import test cases from CSV with validation
- [ ] Playground UI: datasets page, dataset detail, run triggering, results view
- [ ] CI integration for automated evaluation

### Out of Scope (v1)

- Real-time collaboration on datasets — complexity not justified for v1
- Dataset sharing/marketplace — focus on single-team use first
- Auto-generated test cases from production traffic — future enhancement
- Virtual folders (slash notation organization) — defer to v1.1, workaround: naming convention
- Saved subsets (named item selections) — defer to v1.1, ad-hoc itemIds[] sufficient for v1
- Statistical significance on score deltas — defer to v1.1

## Context

**Existing infrastructure to leverage:**
- Storage domain pattern (workflows, memory, scores) — add datasets domain
- Evals package with scorer interface — reuse for dataset scoring
- Playground UI patterns — extend for datasets pages
- Request context — pass through to dataset runs

**Prior art researched:**
- Langfuse datasets feature (see `.planning/research/`)
- Braintrust evaluation system
- LangSmith datasets
- Internal requirements docs (Notion — linked below)

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
| New storage domain for datasets | Follows existing pattern (workflows, memory, scores) | ✓ Confirmed |
| Scorers passed to run, not inherited from target | Separates concerns, allows different scoring per experiment | ✓ Confirmed |
| Runs persist forever | Simplifies v1, can add cleanup later | ✓ Confirmed |
| Allow cross-version comparison with clear warnings | Real use case (added edge cases), but surface caveats | ✓ Confirmed |
| Auto-versioning on item changes | Simpler than explicit versioning, better UX (Braintrust pattern) | ✓ Confirmed |
| Timestamp-based versioning | Follows Langfuse pattern: version is Date, not integer. Avoids breaking change later | ✓ Confirmed |
| Schema validation optional | Some datasets are exploratory, don't force schema upfront | ✓ Confirmed |
| Scorer/processor as valid targets | Unique Mastra capability, test components in isolation | ✓ Confirmed |
| Item selection via `itemIds[]` param | Quick iteration on subsets before full runs, cost control | ✓ Confirmed |
| Defer virtual folders to v1.1 | Organizational polish, not core workflow | ✓ Confirmed |
| Input stored as `unknown` (any JSON) | Flexibility: string for simple prompts, objects for structured. Target adapter normalizes at execution time | ✓ Confirmed |

## References

- [Backend Requirements (Notion)](https://www.notion.so/kepler-inc/Datasets-Backend-Requirements-2f0ebffbc9f880f08476e03002023695)
- [UI Requirements (Notion)](https://www.notion.so/kepler-inc/Dataset-UI-Requirements-2f0ebffbc9f8807f99a9e1c7a3104140)

---
*Last updated: 2026-01-23 after requirements merge*

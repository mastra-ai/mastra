# Project Research Summary

**Project:** AI Evaluation Datasets for Mastra
**Domain:** AI framework evaluation infrastructure
**Researched:** 2026-01-23
**Confidence:** HIGH

## Executive Summary

AI evaluation datasets are structured collections of test cases (input/expected output pairs) that measure AI system quality through automated and human scoring. Industry leaders (Langfuse, Braintrust, LangSmith) follow a consistent three-tier architecture: data layer (versioned datasets), execution layer (runs against targets with scoring), and presentation layer (comparison and analysis). Mastra's existing infrastructure—storage domains, scorer system, request context, server patterns—maps directly to this architecture with minimal new concepts.

The recommended approach leverages Mastra's existing patterns: introduce `DatasetsStorage` as a new storage domain (following workflows/memory/scores patterns), reuse the existing scorer interface from `packages/evals/`, and follow established server route patterns. The core differentiator is auto-versioning (simpler than explicit version management) combined with cross-version comparison warnings (prevents misleading conclusions when datasets drift). Integration is clean: datasets don't reinvent scorers or storage—they orchestrate existing primitives.

Key risks center on dataset staleness (users modify prompts but forget test cases), non-deterministic scoring creating noise, and tight coupling to Mastra-specific targets limiting adoption. Mitigation: auto-version on every change, surface score distributions not single values, design target interface as a protocol (support any callable function, not just Mastra agents). The architecture inherently avoids storage complexity by reusing `ScoresStorage` and following established patterns.

## Key Findings

### Recommended Stack

Mastra already has everything needed—no new core dependencies required. Leverage existing storage backends (PostgreSQL via pg store, LibSQL for lighter deployments), existing Zod schemas for type safety, existing Hono server patterns, existing p-map for concurrent execution. The only new dependency is Papa Parse (CSV import) in the CLI package.

**Core technologies:**
- **DatasetsStorage domain**: New storage domain following workflows/memory pattern — reuses composite store infrastructure
- **Existing Scorers (packages/evals/)**: Reuse scorer interface directly — datasets pass input/output/groundTruth from items
- **Zod schemas**: Type-safe validation for dataset entities — already used throughout Mastra
- **Hono + existing route patterns**: Server API following scores.ts pattern — minimal new patterns
- **p-map**: Concurrent item execution with rate limiting — already dependency in core

**Critical version requirements:**
- None — all dependencies already present in Mastra stack
- Papa Parse ^5.4.1 for CSV import (CLI only, well-tested library)

### Expected Features

Research from Langfuse, Braintrust, LangSmith reveals clear table stakes vs differentiators.

**Must have (table stakes):**
- Dataset CRUD with naming, description, metadata
- Items with input/expected output/context (any JSON)
- Bulk CSV import (adoption blocker without it)
- Run dataset against target (agent/workflow/function)
- Select scorers per run (decouple scoring from target)
- Results view with per-item outputs and scores
- Compare two runs side-by-side with score deltas
- SDK for programmatic access (CI integration)

**Should have (competitive):**
- Auto-versioning on item changes (simpler UX than explicit versions)
- Baseline run pinning (reference point for regression detection)
- Cross-version comparison with warnings (handle dataset drift)
- Progress streaming during runs (don't make users wait blind)
- Export results (data portability)

**Defer (v2+):**
- Human evaluation workflow (complex, Braintrust does well)
- Trace integration (create items from production traces)
- Version diff view (visualize changes between versions)
- GitHub Action (automated PR evaluation)
- Comments/annotations (collaboration features)
- Statistical significance on deltas (requires mature data)

### Architecture Approach

Three-tier architecture: **Data Layer** (datasets, items, versions in new `DatasetsStorage` domain), **Execution Layer** (run executor orchestrating target calls and scorer application), **Presentation Layer** (comparison, analysis UI). Components have clear boundaries: `DatasetsStorage` owns dataset/item/run records but NOT scores (reuse `ScoresStorage`), run executor orchestrates but delegates to existing agents/workflows for execution and existing scorers for scoring, target adapter normalizes different target types (agent vs workflow vs custom function).

**Major components:**
1. **DatasetsStorage** — new storage domain for datasets/items/runs/results, follows workflow/memory pattern
2. **Run Executor** — orchestrates item execution, scorer application, progress tracking (lives in core package)
3. **Target Adapter** — protocol interface supporting agents, workflows, or any callable (prevents tight coupling)
4. **Datasets API** — Hono routes following scores.ts pattern (server package)
5. **Playground UI** — datasets page, run results, comparison view (follows existing nav/list/detail patterns)
6. **CLI** — `mastra datasets run` command for CI integration

**Data flow:** User creates dataset → adds items (auto-increments version) → triggers run with target + scorers → executor loads items, calls target for each, stores result, applies scorers → scores stored in existing `ScoresStorage` linked to run results → comparison API computes deltas across runs.

### Critical Pitfalls

From analysis of Langfuse, Braintrust, LangSmith user patterns and Mastra architecture:

1. **Dataset Staleness** — Users modify prompts/models but forget test cases. Dataset drifts from reality. **Avoid:** Auto-version on ANY item change, surface version metadata prominently, warn loudly when comparing runs across versions with different item counts.

2. **Non-Deterministic Scoring** — LLM-based scorers produce variance. Single-run comparisons become noise. **Avoid:** Display score distributions not single values, provide scorer type metadata (deterministic vs stochastic), consider multiple runs per item for confidence intervals.

3. **Missing I/O Preservation** — Storing only scores without actual outputs breaks debugging. **Avoid:** Store full input/output for EVERY run result, implement storage size limits with clear warnings, provide replay functionality.

4. **Tight Target Coupling** — Only working with Mastra agents limits adoption. **Avoid:** Design target as protocol interface (any callable async function), support importing existing outputs for scoring without re-running, separate "run against target" from "eval with stored output."

5. **Uncontrolled Comparisons** — Comparing runs with different models AND different datasets produces invalid conclusions. **Avoid:** Capture target configuration snapshot in run metadata (model, prompt hash), block or warn when dataset versions differ, provide "what changed" summary between runs.

## Implications for Roadmap

Based on research, suggested phase structure follows architecture tiers and dependency graph:

### Phase 1: Storage Foundation
**Rationale:** Must establish data model before anything else. New storage domain = foundation for all other features. Follow proven Mastra pattern.
**Delivers:** `DatasetsStorage` interface, Zod schemas, PostgreSQL implementation, in-memory test implementation
**Addresses:** Dataset CRUD, items with input/expected/metadata (table stakes)
**Avoids:** Dataset staleness (auto-versioning built into schema), missing I/O preservation (full output storage from start)
**Research flag:** Standard storage pattern — no additional research needed

### Phase 2: API Layer
**Rationale:** Depends on storage. Needed before execution or UI. Follows existing server route patterns.
**Delivers:** Hono routes for dataset CRUD, item CRUD, route registration in server package
**Uses:** Zod schemas from Phase 1, existing Hono patterns from scores.ts
**Implements:** Datasets API component
**Addresses:** Programmatic access (table stakes for CI)
**Research flag:** Standard API pattern — no additional research needed

### Phase 3: Execution Engine
**Rationale:** Core value delivery. Depends on storage + API. Must run before comparison makes sense.
**Delivers:** Run executor, target adapter interface, run triggering API, progress streaming
**Uses:** Existing scorers from packages/evals/, existing p-map for concurrency
**Implements:** Execution Layer components
**Addresses:** Run dataset against target, select scorers, results with outputs/scores (table stakes)
**Avoids:** Scorer-target mismatch (type validation at run creation), tight coupling (protocol interface), cost/latency ignorance (progress + concurrency controls)
**Research flag:** Needs research for target adapter protocol design (multiple target types, streaming vs non-streaming)

### Phase 4: Comparison & Analysis
**Rationale:** Depends on execution producing results. Comparison is table stakes feature.
**Delivers:** Run comparison logic, comparison API routes, delta computation, cross-version handling
**Implements:** Presentation Layer (backend)
**Addresses:** Compare two runs, score deltas, baseline concept (competitive feature)
**Avoids:** Uncontrolled comparisons (version warnings), no baseline concept (baseline pinning built in)
**Research flag:** Standard pattern — no additional research needed

### Phase 5: Playground UI
**Rationale:** Depends on full API (CRUD + runs + comparison). Usability layer over working backend.
**Delivers:** Dataset list/detail pages, run results view, comparison UI, navigation integration
**Uses:** Existing playground patterns (sidebar, list views, detail panels)
**Implements:** Presentation Layer (frontend)
**Addresses:** UI for all table stakes features
**Avoids:** Setup friction (progressive disclosure, quick run path)
**Research flag:** Standard React/Tailwind patterns — no additional research needed

### Phase 6: Bulk Operations & CI
**Rationale:** Depends on API + UI being solid. Adoption accelerators.
**Delivers:** CSV import with validation, export, `mastra datasets run` CLI command
**Uses:** Papa Parse for CSV, existing CLI patterns
**Addresses:** Bulk import (table stakes), CI integration (competitive)
**Avoids:** Bulk import without validation (preview + dry-run mode), CI without failure semantics (threshold support)
**Research flag:** Needs research for CSV validation patterns and CLI output formats for CI consumption

### Phase Ordering Rationale

- **Foundation first:** Storage domain must exist before anything else (Phase 1)
- **API before execution:** Server routes needed for both manual testing and UI consumption (Phase 2)
- **Execution before comparison:** Can't compare runs that don't exist (Phase 3 → 4)
- **Backend before frontend:** UI depends on working API (Phases 1-4 → 5)
- **Core before optimization:** CSV/CLI are adoption features but not critical path (defer to Phase 6)

**Dependency chain:** Phase 1 (foundation) → Phase 2 (API) → Phase 3 (execution) → Phase 4 (comparison) → Phase 5 (UI) → Phase 6 (bulk/CI)

**Pitfall mitigation:** Auto-versioning in Phase 1 schema prevents staleness, I/O preservation in Phase 3 execution enables debugging, target protocol in Phase 3 prevents tight coupling, version warnings in Phase 4 prevent misleading comparisons.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (Execution Engine):** Target adapter protocol design — needs research on supporting multiple target types (agents, workflows, raw functions), handling streaming vs non-streaming, extracting outputs from different response formats
- **Phase 6 (Bulk Operations):** CSV validation patterns — needs research on Papa Parse error handling, row-level error reporting, dry-run implementation

Phases with standard patterns (skip research-phase):
- **Phase 1 (Storage):** Follows existing DatasetsStorage/WorkflowsStorage pattern exactly — well-documented in codebase
- **Phase 2 (API):** Follows scores.ts route pattern exactly — well-documented in codebase
- **Phase 4 (Comparison):** Standard aggregation/delta logic — no novel patterns
- **Phase 5 (Playground UI):** Follows existing agents/workflows UI patterns — well-documented in packages/playground-ui/

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All dependencies already in Mastra, no new integrations required |
| Features | HIGH | Langfuse, Braintrust, LangSmith have converged on same table stakes — clear signal |
| Architecture | HIGH | Maps directly to existing Mastra patterns (storage domains, scorers, server routes) |
| Pitfalls | HIGH | Patterns observed across multiple competitor products + Mastra architecture analysis |

**Overall confidence:** HIGH

Research based on official competitor documentation (Langfuse, Braintrust, LangSmith), direct Mastra codebase analysis (packages/core, packages/evals, packages/server, stores/), and established evaluation system patterns. No novel concepts required—datasets orchestrate existing primitives.

### Gaps to Address

**Target adapter protocol design:** Research identified need to support agents, workflows, and custom functions, but exact interface needs design during Phase 3 planning. Consider: how to extract outputs from different target types, handling streaming responses, error propagation.

**Score distribution display:** Pitfall research flags non-deterministic scoring, but didn't specify UI patterns for displaying distributions vs single values. Consider: histograms, confidence intervals, median vs mean—needs UX research during Phase 5 planning.

**Baseline management:** Feature research recommends baseline pinning, but workflow unclear (when to update baseline, who can change it, how to track history). Needs user flow design during Phase 4 planning.

**CSV validation UX:** Pitfall research recommends preview + dry-run, but exact flow needs design during Phase 6 planning. Consider: streaming validation for large files, progressive error display, partial import handling.

## Sources

### Primary (HIGH confidence)
- Mastra codebase — packages/core/src/storage/, packages/evals/, packages/server/src/server/handlers/, stores/ (existing patterns)
- Langfuse documentation — dataset features, versioning approach, trace integration
- Braintrust documentation — auto-versioning, experiment comparison, scorer composition
- LangSmith documentation — dataset schemas, evaluator patterns, example structure

### Secondary (MEDIUM confidence)
- Competitor user patterns — inferred from public documentation and feature descriptions
- Evaluation system anti-patterns — common across industry (staleness, non-determinism, comparison validity)

### Tertiary (LOW confidence)
- None — all findings grounded in primary sources

---
*Research completed: 2026-01-23*
*Ready for roadmap: yes*

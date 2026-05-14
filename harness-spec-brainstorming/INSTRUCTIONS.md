# Instructions

The files under `sections/` are the source of truth for Harness v1 brainstorming. Git is the source of truth for tracking section updates.

Mandatory: before running any background CLI council, read `HOW_TO_USE_CLIS.md`. It defines the mandatory reviewer set, read-only prompt shape, and exact Codex model requirement. For non-trivial spec work, map the change to the relevant `sections/`, `issues/`, and `OBJECTIVES.md` entries.

Use a single writing orchestrator for Harness changes. In this workspace, the active Codex session is that orchestrator. It owns scoping, council prompts, verification, edits, tests, and the final explanation. Other models are invoked only as background CLI council and never write files.

For non-trivial Harness design or implementation changes, run background CLI council from:

- Claude CLI reviewer
- OpenCode CLI reviewer using `google-vertex/gemini-3.1-pro-preview-customtools` with the
  `high` variant and Vertex env vars
- Codex CLI reviewer using `gpt-5.5` with high reasoning
- OpenCode CLI reviewer using DeepSeek V4 Pro with the `max` variant
- OpenCode CLI reviewer using `alibaba-coding-plan/qwen3.6-plus` (Alibaba
  Coding Plan provider, no variant flag)
- OpenCode CLI reviewer using `xai/grok-4.3` with the `high` variant

Council prompts must be narrow. Give each model the user goal, the relevant `sections/` files, and the objectives to protect. Ask for cited risks, concrete constraints, missing edge cases, false positives, incomplete recovery logic, and diff-shaped recommendations. Do not ask council models to edit files.

Council output is advisory. The orchestrator must independently verify every useful claim against the relevant split files, `OBJECTIVES.md`, and current Mastra code when the design depends on existing behavior. Unsupported advice is discarded. Relevant advice is folded into one coherent orchestrator-owned diff.

When resolving issues into `sections/`, do not overthink or over-engineer the solution. Prefer the smallest spec change that settles the invariant, removes the contradiction, or records a deliberate deferral. Before introducing a new concept, storage record, API, event, route, or term, check whether an existing section element already owns that responsibility. If concepts overlap, consolidate the wording around the canonical owner and add cross-references instead of creating parallel definitions.

For issue work, be skeptical by default. Before adding or changing a claim, explicitly question its relevance, pertinence, and materiality for Harness v1: what invariant it protects, which source-of-truth section or code path it changes, whether it is already solved, deferred, or rejected, and whether it belongs as a new issue instead of evidence on an existing one. Always check `issues/open/`, `issues/close/`, and relevant `sections/` files before writing.

Mastra fit check is mandatory for any issue or section change that proposes (a) a new storage record, table, ledger, or tombstone, (b) a new worker, claim or renewal loop, or scheduler, (c) a new event ordering or replay primitive, (d) a new callback or webhook binding, (e) a new suspension or resume primitive, (f) a new subagent runtime or delegation path, (g) a new method on the runtime or request context, or (h) a new wire-protocol surface. The orchestrator must (1) read `sections/11-migration-from-current-harness/06-current-vs-v1-status-ledger.md` first to check whether the spec already classifies the relevant name against `packages/core/src/...`, (2) `rg` the full `sections/` tree for citations of the candidate Mastra-core path (citations in `sections/14-*`, `sections/13-*`, and `sections/06-*` are often the load-bearing ones), and (3) cite the existing Mastra primitive that owns the responsibility — the canonical inventory lives in `OBJECTIVES.md` under `Mastra Primitive Reuse Discipline`. Either restate the change as an extension of that primitive or record the concrete invariant or scope reason that prevents reuse. An issue that proposes a parallel Harness construct without this citation cannot move to `open/` and must be reframed. If no existing Mastra primitive owns the responsibility, document the gap explicitly and state why a Harness-only primitive is needed in v1.

Authority check is mandatory whenever the proposed change records the same Harness fact, identity, or state in more than one row, cache, or projection. Declare the primary authority and how dependents reference it before opening the issue. Before claiming a duplication, verify that the spec does not already declare the authority (e.g. read projections vs persisted authorities, FIFO receipts vs goal-side projections, slot accessors vs replacement types). The current authority overlaps that must each name a primary live in `OBJECTIVES.md` under `Internal Authority Discipline`.

Issue relationships are part of the issue, not optional metadata. When opening, closing, reclassifying, or editing an issue, review both open and closed issues for prerequisites, dependents, overlaps, and commonly-confused claims, then update `Related Issues` where needed.

Every issue transition requires a council artifact. Opening, materially editing (Evidence, Better direction, Reverification, or Related Issues), closing, or reopening an issue needs either a recorded council pass or a one-line `editorial-only` justification when no technical claim changes. Capture this in the issue file under a `Council:` block listing reviewers run, the model selectors used, claim classifications (`accept` / `adapt` / `reject` / `conflict`), the rebuttal round outcome when one ran, and any reviewer that was unavailable. An issue cannot move to `close/` without a Council block.

Iteration should stay bounded. Re-run council when the scope changes materially, when reviewers surface conflicting interpretations, or when a high-risk diff needs a second pass. Do not run another council loop for small editorial follow-ups the orchestrator can verify directly.

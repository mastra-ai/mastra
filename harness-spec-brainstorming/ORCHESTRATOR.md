# Orchestrator Workflow

The active Codex session is the only writer. It coordinates model council through CLI calls, verifies the results, and applies only the relevant changes.

## 1. Scope

Start by identifying:

- the user goal
- the section files under `sections/` involved
- the objectives that must not regress
- the existing concepts, records, APIs, events, and routes that may already cover
  the requested fix
- the narrowest code, docs, or test surface likely to change

Do not inspect unrelated reference material or examples unless the user explicitly asks.

## 2. Run CLI Council

For non-trivial Harness changes, run council as background CLI work:

- one Claude CLI review using the default model
- one OpenCode CLI review using `google-vertex/gemini-3.1-pro-preview-customtools` with
  the `high` variant and Vertex env vars
- one Codex CLI review using `gpt-5.5` with high reasoning
- one OpenCode CLI review using `deepseek/deepseek-v4-pro` with the `max`
  variant
- one OpenCode CLI review using `alibaba-coding-plan/qwen3.6-plus` (Alibaba
  Coding Plan provider, no variant flag)
- one OpenCode CLI review using `xai/grok-4.3` with the `high` variant

Read `HOW_TO_USE_CLIS.md` before running council. It is the source of truth for
the exact command forms, prompt shape, model selectors, and failure handling.

Keep council outputs outside the repo, for example under `/private/tmp`, unless the user asks to preserve them. The repo should contain the final spec, split files, and implementation changes, not raw model transcripts.

Each CLI prompt should require:

- exact citations to `sections/` files
- a short list of risks or contradictions
- concrete constraints the final diff must satisfy
- diff-shaped recommendations where useful
- explicit uncertainty when the model cannot verify a claim

Model output is advisory only.

## 3. Verify

For each council claim, classify it before using it:

- `accept`: cited, relevant, and consistent with the section specs and objectives
- `adapt`: useful, but needs rewriting to fit the Harness v1 contract
- `reject`: unsupported, stale, duplicative, out of scope, or inconsistent
- `conflict`: useful but incompatible with the current section specs

Verify accepted and adapted claims against:

- the relevant files under `sections/`
- `OBJECTIVES.md`
- related open and closed issue files, especially overlapping or prerequisite
  concepts
- affected package-local instructions and tests when implementation files are involved
- current Mastra source files when the spec depends on existing runtime behavior

If a valid suggestion conflicts with existing section text, update the relevant section files intentionally and keep cross-references consistent.

## 4. Write

Only the orchestrator writes files. Do not ask the council models to edit the workspace directly.

When changing the spec, edit the relevant files under `sections/` directly. Treat each issue as a task to improve the section source of truth, not as permission to add a larger design. Use the smallest change that resolves the invariant. Reuse existing concepts and canonical terms; when a fix overlaps another section element, update the canonical owner and add cross-references instead of creating a duplicate concept.

When changing implementation, keep the patch scoped to the affected packages and run the narrowest useful checks.

The final update should be one coherent change set that preserves the Harness contract and keeps related sections aligned with each other.

## 5. Iterate

Run another council loop only when:

- the accepted change materially changes the design surface
- council models disagree on a contract-level interpretation
- verification exposes a spec contradiction
- implementation reveals behavior the spec did not account for

For small follow-up edits, the orchestrator should verify directly and continue without another model round.

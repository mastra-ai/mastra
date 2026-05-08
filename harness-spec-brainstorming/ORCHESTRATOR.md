# Orchestrator Workflow

The active Codex session is the only writer. It coordinates model council through CLI calls, verifies the results, and applies only the relevant changes.

## 1. Scope

Start by identifying:

- the user goal
- the canonical spec sections involved
- the split files under `sections/` that mirror those sections
- the objectives that must not regress
- the narrowest code, docs, or test surface likely to change

Do not inspect unrelated reference material or examples unless the user explicitly asks.

## 2. Run CLI Council

For non-trivial Harness changes, run council as background CLI work:

- two independent Codex CLI reviews
- one Claude CLI review using the default model
- one Gemini CLI review using Gemini 3.1 Pro Preview

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

- `accept`: cited, relevant, and consistent with the canonical spec and objectives
- `adapt`: useful, but needs rewriting to fit the Harness v1 contract
- `reject`: unsupported, stale, duplicative, out of scope, or inconsistent
- `conflict`: useful but incompatible with the current canonical spec

Verify accepted and adapted claims against:

- `../HARNESS_V1_SPEC.md`
- the relevant files under `sections/`
- `OBJECTIVES.md`
- affected package-local instructions and tests when implementation files are involved

If a valid suggestion conflicts with the canonical spec, update the canonical spec intentionally first, then regenerate the affected split files.

## 4. Write

Only the orchestrator writes files. Do not ask the council models to edit the workspace directly.

When changing the spec, edit `../HARNESS_V1_SPEC.md` first and regenerate the affected split files from it. When changing implementation, keep the patch scoped to the affected packages and run the narrowest useful checks.

The final update should be one coherent change set that preserves the Harness contract and keeps the split files aligned with the canonical spec.

## 5. Iterate

Run another council loop only when:

- the accepted change materially changes the design surface
- council models disagree on a contract-level interpretation
- verification exposes a spec contradiction
- implementation reveals behavior the spec did not account for

For small follow-up edits, the orchestrator should verify directly and continue without another model round.

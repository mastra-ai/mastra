# Instructions

`../HARNESS_V1_SPEC.md` is canonical. The files under `sections/` are a verbatim split for focused review and must preserve every source detail. Regenerate or update them only when the canonical spec changes; git is the source of truth for tracking those updates.

Use a single writing orchestrator for Harness changes. In this workspace, the active Codex session is that orchestrator. It owns scoping, council prompts, verification, edits, tests, and the final explanation. Other models are invoked only as background CLI council and never write files.

For non-trivial Harness design or implementation changes, run background CLI council from:

- Codex CLI reviewer A
- Codex CLI reviewer B
- Claude default CLI reviewer
- Gemini CLI reviewer using Gemini 3.1 Pro Preview

Council prompts must be narrow. Give each model the user goal, the relevant `sections/` files, and the objectives to protect. Ask for cited risks, concrete constraints, and diff-shaped recommendations. Do not ask council models to edit files.

Council output is advisory. The orchestrator must independently verify every useful claim against `../HARNESS_V1_SPEC.md`, the relevant split files, and `OBJECTIVES.md`. Unsupported advice is discarded. Relevant advice is folded into one coherent orchestrator-owned diff.

Iteration should stay bounded. Re-run council when the scope changes materially, when reviewers surface conflicting interpretations, or when a high-risk diff needs a second pass. Do not run another council loop for small editorial follow-ups the orchestrator can verify directly.

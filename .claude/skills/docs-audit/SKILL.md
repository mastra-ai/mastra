---
name: docs-audit
description: Interactive documentation quality review for Mastra docs. Use when auditing, reviewing, or critiquing Mastra documentation; checking docs against source code; validating code examples, API accuracy, or property completeness; checking whether docs follow the styleguide and deterministic linters; or evaluating whether a beginner or agent can follow a doc to complete a job. This skill keeps humans in the loop with ask_user and submit_plan, then always runs an agent-build eval after approved fixes.
---

# Documentation Audit

Audit Mastra docs against source, deterministic checks, styleguides, and followability. Produce an evidence-based report first, then an approved fix plan, then mandatory eval after fixes.

Use this for audits/reviews/critiques/accuracy checks/completeness checks/followability checks, not ordinary docs authoring.

## References

Load during the audit:

- `references/RUBRIC.md`: audit dimensions and severity rules
- `references/AUDIT-REPORT.md`: required report format
- `.claude/skills/mastra-docs/references/STYLEGUIDE.md`: base docs styleguide
- One matching page-type guide from `.claude/skills/mastra-docs/references/`: `DOC.md`, `GUIDE_QUICKSTART.md`, `GUIDE_TUTORIAL.md`, `GUIDE_INTEGRATION.md`, `GUIDE_DEPLOYMENT.md`, or `REFERENCE.md`

## Scripts

Use scripts for deterministic mechanics; do not hand-roll run dirs, snapshots, lint capture, eval scaffolds, typecheck logging, or local package linking. Invoke from anywhere as `bash .claude/skills/docs-audit/scripts/<name>.sh ...`.

- `init-run.sh --docs <files>`: create the temp run directory and print `RUN_DIR=...`.
- `snapshot.sh --run-dir "$RUN_DIR" --stage original|improved --docs <files>`: copy audited docs into the run dir.
- `run-checks.sh --run-dir "$RUN_DIR" --docs <files>`: run validation, repo-wide and target-scoped remark/Vale, file-scoped Prettier, and write raw output plus `$RUN_DIR/commands/summary.txt`.
- `format-doc.sh --docs <files>`: format changed docs from the docs package cwd so `docs/.prettierrc` and `docs/.prettierignore` apply.
- `eval-setup.sh --run-dir "$RUN_DIR" --job "..." --doc <file> --pkg @mastra/...`: create an eval job/project, copy `doc-under-test.mdx`, resolve local packages, and print `JOB_DIR=...`.
- `eval-typecheck.sh --job-dir "$JOB_DIR"`: run TypeScript verification and append output to `commands.log`.

## Artifact policy

- Keep intermediate artifacts outside the repo in the script-created `$RUN_DIR`.
- Run `init-run.sh` before deterministic checks and report the exact printed path, including `$TMPDIR` fallbacks.
- Snapshot original docs immediately after scope confirmation; snapshot improved docs after approved fixes and before eval.
- Save `audit-report.md`, `fix-plan.md`, eval `instructions.md`, `commands.log`, and `result.md` under `$RUN_DIR`.
- Do not commit or stage temp artifacts. Keep the directory until the final response and include its path.

## Required workflow

### 1. Scope interactively

Use `ask_user` to ask which doc page, URL/path, topic, category, or multi-page scope to audit.

DO free-text scope prompt with only `question`:

```ts
ask_user({ question: 'Which doc page should I audit? Paste a path, URL, or topic.' });
```

DON'T pass `options` or `selectionMode` for free text. If a free-text prompt errors with `selectionMode requires options`, you passed `selectionMode` without `options` — drop both keys and retry; do not fall back to plain chat.

Resolve to docs files under `docs/src/content/en/docs/`, `docs/src/content/en/guides/`, or `docs/src/content/en/reference/`. If ambiguous, present plausible matches. Prefer one page unless the user asks for a category. Treat more than five pages as too broad unless the user approves a narrowed scope or representative sample.

After reading scoped pages, derive 2–4 concrete jobs-to-be-done from each doc's title, intro, headings, examples, page type, and promise. Do not ask the user to invent jobs. Ask the user to select jobs with multi-select and explicit options:

```ts
ask_user({ question, options: [...], selectionMode: "multi_select" })
```

Only use `selectionMode` with `options`. Selected jobs seed practicability checks and mandatory eval. Confirm multi-page scope before auditing.

### 2. Classify page type and styleguide

Classify each scoped file before style checks:

- `docs/src/content/en/docs/**/overview.mdx`: docs overview
- `docs/src/content/en/docs/**`: docs standard
- `docs/src/content/en/guides/getting-started/**`: guide quickstart
- deployment paths or titles like `Deploy Mastra to ...`: guide deployment
- tutorial paths or titles like `Guide: Building ...`: guide tutorial
- integration paths or titles like `Using ...`: guide integration
- `docs/src/content/en/reference/**`: reference
- otherwise: other

If classification overlaps, prefer the matching frontmatter title pattern; otherwise choose by structure. Apply `STYLEGUIDE.md` plus the matching page-type guide and state the classification in the report.

### 3. Map docs to source

Read docs and collect frontmatter `packages:`, `@mastra/<name>` imports, mentioned APIs, `<PropertiesTable>` entries, and code-block file paths.

Resolve each `@mastra/<pkg>` import to the matching workspace `package.json`, then inspect its `exports` and `src/index.ts` before any repo-wide search. For the exact exported symbol/type, use `lsp_inspect` or `view` on the narrow export/type file first. Only broaden to `search_content` if the narrow export/type read is ambiguous.

Do not guess paths. `@mastra/core` usually maps to `packages/core/src`; `@mastra/<name>` often maps to `packages/<name>/src`, but the package `name` field is authoritative. For symbols like `cloneThread` that are noisy across tests, controllers, and docs, start from the package export surface such as `packages/memory/src/index.ts`.

Source is the source of truth for code accuracy and API completeness; never trust doc snippets at face value. If activated skill text conflicts with the on-disk skill files, trust the on-disk files.

### 4. Run deterministic checks

Run:

```sh
bash .claude/skills/docs-audit/scripts/run-checks.sh --run-dir "$RUN_DIR" --docs <audited-files>
```

The script handles cwd, capture, target-scoped lint summaries, file-scoped Prettier, and missing local Vale as a warning. Read `$RUN_DIR/commands/summary.txt` first: `*-target` lines are the audit signal, and `repo-wide-failures` is unrelated noise to list separately. Do not run formatting commands that write files during the audit phase.

### 5. Apply the rubric

Load `references/RUBRIC.md` and score all dimensions:

1. Styleguide adherence
2. Deterministic linting
3. Code example accuracy
4. API/property completeness
5. Practicability

For code accuracy, verify imports, exports, constructors, methods, properties, options, required fields, model-token usage, and `new Agent()` fields. For generic/overload-heavy APIs, check TypeScript inference closely, including literal IDs, registry keys, version selectors, and overload parameters.

For completeness, compare documented APIs to exported source APIs for the page scope; on reference pages, verify methods have real examples and `<PropertiesTable>` entries include `name`, `type`, and `description`.

For practicability, use the selected jobs. Check whether a beginner or agent can complete the job from the doc alone, including prerequisites, jargon, expected output, verification, and TypeScript-copyability for inference-sensitive examples.

Every finding needs `file:line` evidence; source-backed findings also need source `file:line` evidence.

### 6. Report before editing

Write `$RUN_DIR/audit-report.md` using `references/AUDIT-REPORT.md`, then present it before proposing edits. Include score table, findings, deterministic output summary, selected jobs, source paths inspected, styleguides applied, and `$RUN_DIR`. If the full report is too long for chat, summarize and provide the full path. Do not edit files yet.

### 7. Submit a fix plan

After the user has seen the report, write `$RUN_DIR/fix-plan.md` and submit it with `submit_plan`. The plan must list files, findings addressed, change types, rationale, verification commands, and mandatory eval per selected job.

Before submitting, inspect nearby table rows, nested properties, headings, and examples around findings; include adjacent stale details that belong to the same API surface. Order fixes by blocker/major accuracy, completeness, practicability, style, then deterministic lint/formatting. Wait for approval before editing.

### 8. Implement approved fixes

Implement only approved fixes. Keep changes focused, follow docs styleguides and `docs/AGENTS.md`, and do not modify examples or unrelated files unless approved. If renaming/deleting docs, update `docs/vercel.redirects.json` and run `pnpm run generate-vercel-redirects` from `docs/`.

### 9. Re-run checks and snapshot improved docs

After fixes, format changed docs with the docs package config:

```sh
bash .claude/skills/docs-audit/scripts/format-doc.sh --docs <changed-audited-files>
```

Then run:

```sh
bash .claude/skills/docs-audit/scripts/run-checks.sh --run-dir "$RUN_DIR" --docs <changed-audited-files>
```

Fix failures caused by approved changes; use `commands/summary.txt` to separate target-page failures from repo-wide noise. Then snapshot improved docs with `snapshot.sh --stage improved`.

### 10. Run mandatory eval

Always run eval after approved fixes and re-linting. For each selected job:

1. Run `eval-setup.sh`, passing every local package the doc imports with repeatable `--pkg` flags. Use the printed `JOB_DIR=...`.
2. Write `$JOB_DIR/instructions.md` with only the selected job, eval rules, and `doc-under-test.mdx` path.
3. Write minimal files under `$JOB_DIR/project/src/` to complete the job, starting from the documented snippet and adding only necessary setup. Do not simplify away registry keys, literal IDs, overload args, or version selectors the doc teaches.
4. Respect credential boundaries: do not use paid/external/prod services unless required and the user provides safe test credentials. If missing, continue to the first credential boundary and report whether the docs got there cleanly.
5. Run `eval-typecheck.sh --job-dir "$JOB_DIR"`; a failing typecheck is an eval result, not a script error.
6. Write `$JOB_DIR/result.md`, separating `Doc friction` from `Harness/environment friction`. Only doc-caused friction becomes follow-up findings.

If using a subagent/fresh isolated turn for the eval, give it only the selected job, `doc-under-test.mdx`, `project/`, `commands.log`, and `result.md` paths. Verify the output before trusting it.

If eval reveals doc-caused friction, add findings, produce a follow-up report section, submit a follow-up plan, re-run checks/eval after approved fixes, preserve original failures in `commands.log`, and replace `result.md` with the latest outcome.

### 11. Finish with proof

Final response must include audited pages, selected jobs, `$RUN_DIR`, eval project paths, changed files, verification commands/outcomes, eval outcomes, and unrelated failures or skipped checks.

## Important rules

- Derive jobs from the doc and let the user choose; the user should not have to invent them.
- Eval after fixes is mandatory.
- Keep artifacts and eval projects outside the repo.
- Separate deterministic lint results from judgment findings.
- Cite evidence with `file:line`.
- Never edit before the audit report and approved plan.
- Reference/apply styleguides; do not duplicate them.
- Treat source as truth for accuracy and completeness.
- Prefer narrow docs checks over repo-wide commands when possible.
- Separate doc friction from harness/environment friction.

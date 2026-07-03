---
name: docs-audit
description: Interactive documentation quality review for Mastra docs. Use when auditing, reviewing, or critiquing Mastra documentation; checking docs against source code; validating code examples, API accuracy, or property completeness; checking whether docs follow the styleguide and deterministic linters; or evaluating whether a beginner or agent can follow a doc to complete a job. This skill keeps humans in the loop with ask_user and submit_plan, then always runs an agent-build eval after approved fixes.
---

# Documentation Audit

Audit Mastra documentation against source code, deterministic linting, styleguides, and practicability. The output is an evidence-based report first, then an approved fix plan, then mandatory eval.

Use this skill for docs quality reviews. Do not use it for ordinary docs authoring unless the user asks for an audit, review, critique, accuracy check, completeness check, or followability check.

## References

Load these files during the audit:

- `references/RUBRIC.md`: audit dimensions and severity rules
- `references/AUDIT-REPORT.md`: required report format
- `.claude/skills/mastra-docs/references/STYLEGUIDE.md`: base Mastra docs styleguide
- One matching page-type guide from `.claude/skills/mastra-docs/references/`:
  - `DOC.md`
  - `GUIDE_QUICKSTART.md`
  - `GUIDE_TUTORIAL.md`
  - `GUIDE_INTEGRATION.md`
  - `GUIDE_DEPLOYMENT.md`
  - `REFERENCE.md`

## Scripts

Use these scripts for deterministic mechanics. Invoke them from anywhere as `bash .claude/skills/docs-audit/scripts/<name>.sh ...`; each script resolves the worktree root from its own location.

- `scripts/init-run.sh`: create the run directory and print `RUN_DIR=...`.
  - Example: `bash .claude/skills/docs-audit/scripts/init-run.sh --docs docs/src/content/en/reference/core/getAgentById.mdx`
- `scripts/snapshot.sh`: copy audited docs into `snapshots/original-docs/` or `snapshots/improved-docs/`.
  - Example: `bash .claude/skills/docs-audit/scripts/snapshot.sh --run-dir "$RUN_DIR" --stage original --docs docs/src/content/en/reference/core/getAgentById.mdx`
- `scripts/run-checks.sh`: run `pnpm validate`, `pnpm lint:remark`, `pnpm lint:vale:ai`, and file-scoped Prettier, writing raw output to `$RUN_DIR/commands/`.
  - Example: `bash .claude/skills/docs-audit/scripts/run-checks.sh --run-dir "$RUN_DIR" --docs docs/src/content/en/reference/core/getAgentById.mdx`
- `scripts/eval-setup.sh`: create an eval job directory, minimal TypeScript project, copy `doc-under-test.mdx`, resolve local workspace packages, and record the linking method.
  - Example: `bash .claude/skills/docs-audit/scripts/eval-setup.sh --run-dir "$RUN_DIR" --job "Retrieve an agent by ID" --doc docs/src/content/en/reference/core/getAgentById.mdx --pkg @mastra/core`
- `scripts/eval-typecheck.sh`: typecheck the eval project and append output to `commands.log`.
  - Example: `bash .claude/skills/docs-audit/scripts/eval-typecheck.sh --job-dir "$JOB_DIR"`

Use the scripts for these steps; do not hand-roll the run dir, lint capture, snapshots, eval project scaffold, or local package linking.

## Artifact and eval workspace policy

Store all intermediate audit artifacts outside the repository worktree unless the user explicitly asks to keep them. Use a temporary run directory with this shape:

```text
/tmp/mastra-docs-audit/<audit-slug>-<YYYYMMDD-HHMMSS>/
├── audit-report.md
├── fix-plan.md
├── commands/
│   ├── validate.txt
│   ├── lint-remark.txt
│   ├── lint-vale-ai.txt
│   └── prettier-check.txt
├── snapshots/
│   ├── original-docs/
│   └── improved-docs/
└── evals/
    └── <job-slug>/
        ├── instructions.md
        ├── doc-under-test.mdx
        ├── project/
        ├── commands.log
        └── result.md
```

Rules:

- Create the temporary run directory by running `scripts/init-run.sh --docs <audited-files>` before deterministic checks. Capture the printed `RUN_DIR=...` value and use that exact path in reports.
- Let `init-run.sh` generate `<audit-slug>` and `<YYYYMMDD-HHMMSS>`. If the environment uses `$TMPDIR` instead of `/tmp`, report the actual printed path.
- Copy audited doc files into `snapshots/original-docs/` immediately after scope confirmation by running `scripts/snapshot.sh --run-dir "$RUN_DIR" --stage original --docs <audited-files>`.
- Copy changed audited doc files into `snapshots/improved-docs/` after approved fixes and before the agent-build eval by running `scripts/snapshot.sh --run-dir "$RUN_DIR" --stage improved --docs <audited-files>`.
- Save `audit-report.md`, `fix-plan.md`, and any follow-up eval report under the run directory, then summarize key findings in chat.
- Do not commit or stage files from `/tmp/mastra-docs-audit/`.
- Keep the temporary directory until the final response so the user can inspect it if needed. Mention the path in the final response.

## Required workflow

### 1. Scope the audit interactively

Use `ask_user` to ask which doc page, topic, or category to audit. For free-text prompts, omit `options` and omit `selectionMode`; only pass `selectionMode` when providing explicit options. Accept:

- a repository-relative file path,
- a docs URL/path,
- a topic name,
- a category such as `agents`, `memory`, `workflows`, or `reference/core`,
- a request like `the whole category`.

Resolve the request to one or more docs files under:

- `docs/src/content/en/docs/`
- `docs/src/content/en/guides/`
- `docs/src/content/en/reference/`

If the scope is ambiguous, find plausible matching docs and ask the user to choose. Prefer a single page unless the user explicitly asks for a category audit. Treat more than five pages as too broad: ask the user to narrow the category or approve a representative sample before continuing.

After reading each scoped page, derive 2–4 candidate jobs-to-be-done from the page itself. Use the title, description, intro, headings, examples, and page type. Do not ask the user to invent a job.

Good candidate jobs:

- are concrete outcomes a reader should be able to complete,
- start with an action verb,
- are narrow enough to evaluate,
- map directly to the doc's promise.

Examples:

- `Create an agent that requires approval before running a tool.`
- `Configure LibSQL-backed memory for an agent and verify thread history persists.`
- `Deploy a Mastra app to Cloudflare and verify the deployed endpoint responds.`

Use `ask_user` with multi-select so the user selects the jobs to check. These selected jobs seed the practicability dimension and the mandatory agent-build eval.

Confirm the final scope before starting the audit when the scope includes multiple pages.

### 2. Classify the page type

Classify each scoped file before applying styleguide checks:

- `docs/src/content/en/docs/**/overview.mdx`: docs overview
- `docs/src/content/en/docs/**`: docs standard
- `docs/src/content/en/guides/getting-started/**`: guide quickstart
- deployment guide paths or pages titled `Deploy Mastra to ...`: guide deployment
- tutorial guide paths or pages titled `Guide: Building ...`: guide tutorial
- integration guide paths or pages titled `Using ...`: guide integration
- `docs/src/content/en/reference/**`: reference
- otherwise: other

If a guide page could be both tutorial and integration, choose the guide whose frontmatter title pattern matches. If no title pattern matches, choose by structure: sequential build steps with `Prerequisites` means tutorial; feature-area sections with `Getting started` means integration. State the classification in the report.

Apply `.claude/skills/mastra-docs/references/STYLEGUIDE.md` first, then the matching page-type guide.

### 3. Map docs to source

Read the doc file and collect:

- frontmatter `packages:` entries,
- every `@mastra/<name>` import in fenced code blocks,
- exported class, function, type, and method names mentioned in headings, prose, code blocks, and `<PropertiesTable>` entries,
- file paths in code block titles.

Resolve package names to source directories:

- `@mastra/core` → `packages/core/src`
- `@mastra/<name>` → first try `packages/<name>/src`
- If that path does not exist, search workspace `package.json` files for `"name": "@mastra/<name>"` and use that package's `src` directory, such as `stores/libsql/src` for `@mastra/libsql`.

Do not guess package paths. Use `find_files`, `search_content`, and `lsp_inspect` to inspect real exports and types.

Start source inspection from the narrowest likely files: package export files, the subdirectory matching the documented API, and type definition files. Avoid package-wide regex searches for common API names until narrow inspection fails. If a search returns excessive noise, stop and narrow the path or pattern before continuing.

Source is the source of truth for code example accuracy and API/property completeness. Never trust the doc's code at face value.

### 4. Run deterministic checks

Create the temporary run directory described in the artifact policy if it does not already exist. Run deterministic checks with the script:

```sh
bash .claude/skills/docs-audit/scripts/run-checks.sh --run-dir "$RUN_DIR" --docs <audited-files>
```

Raw output lands in `$RUN_DIR/commands/`:

- `validate.txt`
- `lint-remark.txt`
- `lint-vale-ai.txt`
- `prettier-check.txt`

The script runs docs commands in subshells, captures combined stdout/stderr, file-scopes Prettier, and treats a missing local Vale binary as `warn` with setup guidance. When a repo-wide command returns output, filter it to the audited file(s) in the report. If unrelated files fail, report them as unrelated and do not count them against the audited page.

Do not run `pnpm run format` during the audit phase because it writes files. Use the scripted Prettier check instead. Formatting changes can be part of the later approved fix plan.

### 5. Run judgment checks against the rubric

Load `references/RUBRIC.md` and apply all five dimensions:

1. Styleguide adherence
2. Deterministic linting
3. Code example accuracy
4. API/property completeness
5. Practicability

For code accuracy:

- verify imports resolve,
- verify constructors, functions, methods, and properties exist,
- verify option objects and required fields match source,
- verify `new Agent()` examples include `id`, `name`, `instructions`, and `model`,
- verify model names and IDs use tokens from `docs/src/plugins/remark-model-tokens/models.ts`,
- for generic or overload-heavy APIs, verify examples under TypeScript inference, not only runtime behavior. Watch for narrow string literal inference from constructor options, registry keys, IDs, version selectors, and overload parameters.

For completeness:

- compare documented APIs against exported source APIs for the page scope,
- flag documented items that no longer exist,
- flag missing exported items that the page should cover,
- for reference pages, verify each method has a real example and every `<PropertiesTable>` entry has `name`, `type`, and `description`.

For practicability:

- use the selected jobs-to-be-done,
- check whether a beginner can follow the doc without unstated context,
- check whether an agent could build the selected job using only the doc,
- identify missing prerequisites, ambiguous steps, undefined jargon, missing expected output, and verification gaps,
- when a selected job depends on fallback behavior, registry lookup, versioning, overloads, or inferred IDs, include a TypeScript-copyability check that mirrors the documented snippet closely enough to catch inference errors.

Every finding must include `file:line` evidence. Include source `file:line` evidence when the finding concerns code accuracy or API completeness.

### 6. Produce the audit report before editing

Format the report with `references/AUDIT-REPORT.md`.

Required behavior:

- Present the report to the user before proposing edits. Prefer showing the complete saved report content. If terminal length makes that impractical, explicitly say the chat response is a summary and provide the full `audit-report.md` path.
- Keep deterministic and judgment dimensions separate.
- Include score table, findings summary, findings, and deterministic command output.
- Include selected jobs-to-be-done.
- Do not edit files yet.

### 7. Propose fixes with human approval

After the user has seen the audit report, convert findings into an implementation plan, write that plan to `<run-dir>/fix-plan.md`, and submit it with `submit_plan`.

The fix plan must include:

- files to change,
- findings addressed,
- exact type of change,
- rationale,
- verification commands,
- the mandatory agent-build eval step for each selected job-to-be-done.

Before submitting the plan, inspect the directly adjacent table rows, nested properties, headings, and examples around each finding. If adjacent stale details are part of the same documented API surface, include them explicitly in the plan instead of relying on discovery during implementation.

Order fixes by impact:

1. Blocker and major code accuracy issues
2. API/property completeness gaps
3. Practicability gaps for selected jobs-to-be-done
4. Styleguide issues
5. Deterministic lint and formatting issues

Wait for approval before editing. If the user requests changes to the plan, revise and resubmit.

### 8. Implement approved fixes

After approval, implement only the approved fixes. Keep changes focused. Follow the docs styleguides and the repo instructions in `docs/AGENTS.md`.

If a fix renames or deletes a doc, update `docs/vercel.redirects.json` and run `pnpm run generate-vercel-redirects` from `docs/`.

Do not modify examples or unrelated files unless the approved plan explicitly requires it.

### 9. Re-run deterministic checks

After fixes, re-run deterministic checks with the script:

```sh
bash .claude/skills/docs-audit/scripts/run-checks.sh --run-dir "$RUN_DIR" --docs <changed-audited-files>
```

If checks fail, fix the approved docs changes and re-run. If failures are unrelated to changed files, report them clearly.

### 10. Run the mandatory agent-build eval

Always run the agent-build eval after approved fixes and re-linting.

For each selected job-to-be-done, run the setup script in its own temporary job directory under `$RUN_DIR/evals/<job-slug>/`:

```sh
bash .claude/skills/docs-audit/scripts/eval-setup.sh \
  --run-dir "$RUN_DIR" \
  --job "<selected job-to-be-done>" \
  --doc <improved-doc> \
  --pkg @mastra/core
```

Pass each local package the doc imports with repeatable `--pkg` flags. The script prints `JOB_DIR=...`, copies `doc-under-test.mdx`, creates `project/`, writes a minimal strict TypeScript config, resolves workspace packages, installs or symlinks local packages, and records the setup method in `setup-method.txt`. Do not hand-roll package linking.

The agent still writes judgment artifacts and eval code:

- Write `$JOB_DIR/instructions.md` containing only the selected job-to-be-done, the eval rules, and the path to `doc-under-test.mdx`.
- Write the minimal files needed under `$JOB_DIR/project/src/` to complete the selected job. Build the eval from the documented code as closely as possible. For reference pages, extract or recreate the exact relevant snippet first, then add only the minimal surrounding setup needed to typecheck or run it. Do not silently simplify away registry keys, literal IDs, overload arguments, or version selectors that the doc is trying to teach.
- Do not use credentials, external paid services, or production deploy targets unless the doc's selected job requires them and the user has explicitly provided safe test credentials. If credentials are missing, continue until the first credential boundary and report whether the docs got the eval to that boundary cleanly.
- Bound the eval to the selected job. Do not add extra features, refactors, or tests that the job does not require.

For TypeScript eval verification, run:

```sh
bash .claude/skills/docs-audit/scripts/eval-typecheck.sh --job-dir "$JOB_DIR"
```

The script appends every typecheck command and output to `$JOB_DIR/commands.log` and prints `RESULT=passed` or `RESULT=failed`. A failing typecheck is an eval result, not a script error.

Write the eval outcome to `$JOB_DIR/result.md`. Separate `Doc friction` from `Harness/environment friction`. Only doc-caused friction becomes follow-up audit findings.

For each selected job-to-be-done, spawn a focused build task using a subagent or fresh isolated turn. The eval agent receives only:

- the selected job-to-be-done,
- `$JOB_DIR/doc-under-test.mdx`,
- `$JOB_DIR/project/` as its workspace,
- `$JOB_DIR/commands.log` and `$JOB_DIR/result.md` output paths.

The eval agent should attempt to complete the job end-to-end in that temporary project. It must record:

- whether the job passed, failed, or was blocked,
- exact setup commands used,
- the first point where the doc caused friction,
- missing inputs or ambiguous instructions,
- any source/code mismatch discovered during the attempt,
- whether any blocker was environmental rather than doc-caused.

Review and verify eval output before trusting it. Treat eval output as untrusted until inspected.

If the eval reveals doc-caused friction:

1. Convert it into new findings.
2. Produce a follow-up report section using `references/AUDIT-REPORT.md`.
3. Submit a follow-up fix plan with `submit_plan`.
4. Repeat deterministic checks and the affected eval after approved fixes.
5. Preserve the original failure in `commands.log`, then append the rerun command and replace `result.md` with the latest outcome so the final result is unambiguous.

### 11. Finish with proof

Final response must include:

- audited page(s),
- selected jobs-to-be-done,
- temporary artifact directory path,
- eval project path(s),
- changed files,
- verification commands and outcomes,
- agent-build eval outcomes,
- any known unrelated failures or skipped checks.

## Important rules

- The user does not provide the jobs-to-be-done; derive options from the doc and let the user choose.
- The agent-build eval is mandatory after fixes. Do not make it optional.
- Store intermediate artifacts and eval projects in the temporary run directory, not in the repository worktree.
- Keep deterministic lint results separate from judgment findings.
- Cite evidence with `file:line`.
- Do not edit before presenting the audit report and receiving plan approval.
- Do not duplicate mastra-docs styleguides. Reference and apply them.
- Source code is the source of truth for accuracy and completeness.
- Prefer narrow, scoped docs checks over repo-wide commands when possible.
- Separate doc friction from harness/environment friction in eval results and final summaries.

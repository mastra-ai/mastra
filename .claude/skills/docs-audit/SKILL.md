---
name: docs-audit
description: Interactive documentation quality review for Mastra docs. Use when auditing docs against source, validating examples or API coverage, checking style and deterministic lint, or evaluating whether a reader or agent can complete the documented job.
---

# Documentation audit

Audit Mastra docs against source, deterministic checks, current styleguides, and practical followability. Report findings before edits, submit a fix plan for approval, then run mandatory evals after approved fixes.

Use this skill for audits and reviews, not ordinary docs authoring.

## References

Load during the audit:

- `references/RUBRIC.md`: audit dimensions and severity
- `references/AUDIT-REPORT.md`: report format
- `.claude/skills/mastra-docs/references/STYLEGUIDE.md`: global writing and accuracy rules
- `.claude/skills/mastra-docs/references/INFORMATION_ARCHITECTURE.md`: canonical ownership and routes
- One page guide: `DOC.md`, `GUIDE_INTEGRATION.md`, or `REFERENCE.md`
- `COMPONENTS.md` when the page uses shared MDX or llms-txt-aware markup
- `AUTHORING_WORKFLOW.md` when approved fixes involve moves, deletions, redirects, or verification

Reference styleguides rather than restating their rules in audit findings.

## Scripts

Invoke scripts from anywhere as `bash .claude/skills/docs-audit/scripts/<name>.sh ...`:

- `init-run.sh --docs <files>`: create the temporary run directory
- `snapshot.sh --run-dir "$RUN_DIR" --stage original|improved --docs <files>`: snapshot audited docs
- `run-checks.sh --run-dir "$RUN_DIR" --docs <files>`: capture validation, Remark, Vale, and file-scoped oxfmt-mdx results
- `format-doc.sh --docs <files>`: format approved MDX changes with oxfmt-mdx
- `eval-setup.sh --run-dir "$RUN_DIR" --job "..." --doc <file> --pkg @mastra/...`: scaffold an eval project
- `eval-typecheck.sh --job-dir "$JOB_DIR"`: typecheck an eval and append its output to `commands.log`

Do not hand-roll run directories, snapshots, check capture, eval scaffolds, package linking, or typecheck logging.

## Artifact policy

- Keep artifacts outside the repository in the script-created `$RUN_DIR`
- Run `init-run.sh` before checks and report its exact printed path
- Snapshot original docs after scope confirmation and improved docs after approved fixes
- Save `audit-report.md`, `fix-plan.md`, eval `instructions.md`, `commands.log`, and `result.md` under `$RUN_DIR`
- Do not commit or stage temporary artifacts

## Workflow

### 1. Confirm scope and jobs

Use `ask_user` to request a page path, URL, topic, category, or multi-page scope. Resolve it to authored files under:

- `docs/src/content/en/docs`
- `docs/src/content/en/integrations`
- `docs/src/content/en/reference`

Generated model pages are not normal edit targets. Treat more than five pages as too broad unless the user approves a narrower scope or representative sample.

Read each scoped page and derive two to four concrete jobs-to-be-done from its title, opening, headings, examples, page type, and promise. Ask the user to select jobs with `ask_user` options and `selectionMode: "multi_select"`. Do not ask the user to invent the jobs.

### 2. Classify each page

Use these report classifications and page guides:

- `docs overview`: `/docs/**/overview.mdx` → `DOC.md`
- `docs page`: other `/docs/**` pages → `DOC.md`
- `deployment integration`: `/integrations/deploy/**` → `GUIDE_INTEGRATION.md`
- `integration`: other `/integrations/**` pages → `GUIDE_INTEGRATION.md`
- `reference`: `/reference/**` → `REFERENCE.md`

Use content and canonical ownership when a filename is misleading. Record the classification and applied guides in the report.

### 3. Establish source truth

Collect frontmatter `packages`, `@mastra/<name>` imports, mentioned APIs, `PropertiesTable` entries, environment variables, commands, and code-block paths.

Resolve each package through its workspace `package.json`. Inspect exports and the narrow source/type file before broad searches. Use `lsp_inspect` when useful. Package metadata is authoritative; do not guess paths from package names.

Verify public APIs against implementation, exported types, package exports, and tests. Treat existing docs as context, not proof.

### 4. Run deterministic checks

Run:

```sh
bash .claude/skills/docs-audit/scripts/run-checks.sh --run-dir "$RUN_DIR" --docs <audited-files>
```

Read `$RUN_DIR/commands/summary.txt` first. `*-target` entries are the audited-page signal; `repo-wide-failures` is unrelated noise to report separately. Do not run write-formatting during the audit phase.

### 5. Apply the rubric

Load `references/RUBRIC.md` and score:

1. Styleguide adherence
2. Deterministic linting
3. Code example accuracy
4. API/property completeness
5. Practicability

For practicability, use the selected jobs. Check prerequisites, jargon, expected results, verification, and TypeScript copyability. Every finding needs doc `file:line` evidence; source-backed findings also need source `file:line` evidence.

### 6. Report before editing

Write `$RUN_DIR/audit-report.md` using `references/AUDIT-REPORT.md`, then present the report before proposing edits. Include scores, findings, command summary, selected jobs, source paths, applied guides, and `$RUN_DIR`.

### 7. Submit a fix plan

After the report, write `$RUN_DIR/fix-plan.md` and submit it with `submit_plan`. List files, findings, changes, rationale, verification, and mandatory evals. Inspect surrounding content before planning so adjacent stale details in the same surface are included. Wait for approval before editing.

### 8. Implement approved fixes

Implement only approved fixes. Follow `docs/AGENTS.md` and the current `mastra-docs` references. Use `AUTHORING_WORKFLOW.md` for moves, deletions, redirects, and checks. Do not modify unrelated files.

### 9. Re-run checks and snapshot

Format changed audited docs:

```sh
bash .claude/skills/docs-audit/scripts/format-doc.sh --docs <changed-audited-files>
```

Then re-run `run-checks.sh`, fix failures caused by approved changes, and snapshot the improved docs with `snapshot.sh --stage improved`.

### 10. Run mandatory evals

For each selected job:

1. Run `eval-setup.sh` with every locally imported package passed through repeatable `--pkg` flags
2. Write `$JOB_DIR/instructions.md` with only the selected job, eval rules, and `doc-under-test.mdx` path
3. Build the smallest project under `$JOB_DIR/project/src` that follows the documentation without simplifying away taught identifiers or options
4. Stop cleanly at credential or external-service boundaries unless the user provides safe test credentials
5. Run `eval-typecheck.sh --job-dir "$JOB_DIR"`
6. Write `$JOB_DIR/result.md`, separating doc friction from harness or environment friction

A failed typecheck is an eval result, not a script failure. Only doc-caused friction becomes a finding. If eval exposes doc friction, report it, submit a follow-up plan, and repeat approved fixes and evals.

### 11. Finish with proof

Report audited pages, classifications, selected jobs, `$RUN_DIR`, eval project paths, changed files, verification outcomes, eval outcomes, and unrelated failures or skipped checks.

## Rules

- Never edit before the audit report and approved plan
- Derive jobs from the docs and let the user select them
- Eval after approved fixes is mandatory
- Keep artifacts and eval projects outside the repository
- Separate deterministic failures from judgment findings
- Separate doc friction from harness or environment friction
- Cite every finding with `file:line` evidence
- Treat source as truth for accuracy and completeness
- Use the narrowest source reads and checks that prove the finding

# Documentation audit report format

Use this format for every docs-audit report. Present the report to the user before generating any fix plan or editing docs.

## Required order

1. Header
2. Scope and selected jobs-to-be-done
3. Score table
4. Findings summary
5. Findings
6. Deterministic command output
7. Recommended fix strategy
8. Next step prompt

## Template

````md
# Documentation audit report

## Header

- Page path: `$DOC_PATH`
- Page type: `$PAGE_TYPE`
- Packages covered: `$PACKAGES_OR_NONE`
- Audit date: `$YYYY-MM-DD`
- Temporary artifact directory: `$RUN_DIR`
- Source paths inspected:
  - `$SOURCE_PATH`
- Styleguides applied:
  - `.claude/skills/mastra-docs/references/STYLEGUIDE.md`
  - `$PAGE_TYPE_STYLEGUIDE`

## Selected jobs-to-be-done

These jobs were derived from the doc and selected by the user:

1. `$JOB_1`
2. `$JOB_2`

## Score table

| Dimension                 | Type                   | Verdict           | Findings | Notes         |
| ------------------------- | ---------------------- | ----------------- | -------: | ------------- |
| Styleguide adherence      | Judgment               | `$PASS_WARN_FAIL` | `$COUNT` | `$SHORT_NOTE` |
| Deterministic linting     | Deterministic          | `$PASS_WARN_FAIL` | `$COUNT` | `$SHORT_NOTE` |
| Code example accuracy     | Judgment               | `$PASS_WARN_FAIL` | `$COUNT` | `$SHORT_NOTE` |
| API/property completeness | Judgment               | `$PASS_WARN_FAIL` | `$COUNT` | `$SHORT_NOTE` |
| Practicability            | Judgment + eval-backed | `$PASS_WARN_FAIL` | `$COUNT` | `$SHORT_NOTE` |

## Findings summary

| Severity |    Count |
| -------- | -------: |
| Blocker  | `$COUNT` |
| Major    | `$COUNT` |
| Minor    | `$COUNT` |
| Nit      | `$COUNT` |

## Findings

### `$FINDING_ID`: `$SHORT_TITLE`

- Severity: `$blocker_major_minor_nit`
- Dimension: `$DIMENSION`
- Evidence:
  - Doc: `$DOC_PATH:$LINE`
  - Source: `$SOURCE_PATH:$LINE` (omit when not relevant)
  - Command: `$COMMAND_NAME` (for deterministic findings)
- Problem: `$WHAT_IS_WRONG`
- Why it matters: `$WHY_THIS_AFFECTS_ACCURACY_COMPLETENESS_STYLE_OR_FOLLOWABILITY`
- Suggested fix: `$ACTIONABLE_FIX`

## Deterministic command output

### `$COMMAND`

Verdict: `$pass_warn_fail`

```text
$RAW_RELEVANT_OUTPUT_OR_NO_RELEVANT_OUTPUT
```
````

Repeat for each command:

- `pnpm validate`
- `pnpm lint:remark`
- `pnpm lint:vale:ai`
- Prettier check

## Recommended fix strategy

Do not implement yet. If the user approves, prepare a `submit_plan` fix plan that:

1. Fixes blocker and major accuracy issues first.
2. Fixes completeness gaps next.
3. Fixes practicability gaps for the selected jobs-to-be-done.
4. Fixes style and deterministic lint issues.
5. Re-runs deterministic checks.
6. Runs the mandatory agent-build eval for each selected job-to-be-done.
7. Feeds eval friction into a follow-up audit report if needed.

## Next step

I can convert these findings into an implementation plan for approval.

````

## Field rules

### Header

- `Page path`: Use the repository-relative path.
- `Page type`: Use one of `docs overview`, `docs standard`, `guide quickstart`, `guide tutorial`, `guide integration`, `guide deployment`, `reference`, or `other`.
- `Packages covered`: Use the doc frontmatter `packages:` values and any package imports found in code blocks.
- `Audit date`: Use the current date.
- `Temporary artifact directory`: Use the actual `/tmp/mastra-docs-audit/<audit-slug>-<YYYYMMDD-HHMMSS>/` path, or the actual `$TMPDIR/mastra-docs-audit/...` fallback path. The slug must follow the SKILL.md slug rules.
- `Source paths inspected`: Include every package source directory or specific source file used as evidence.
- `Styleguides applied`: Always include STYLEGUIDE.md and exactly one page-type guide when applicable.

### Score table

- Use `pass`, `warn`, or `fail` only.
- Count findings assigned to that dimension.
- Keep deterministic linting separate from styleguide judgment even when both concern prose or formatting.
- If a deterministic tool cannot run because of environment setup, use `warn` and explain `skipped — <reason>`.

### Findings

Finding IDs must use stable prefixes:

- `STYLE-001`, `STYLE-002`, ...
- `LINT-001`, `LINT-002`, ...
- `CODE-001`, `CODE-002`, ...
- `API-001`, `API-002`, ...
- `PRAC-001`, `PRAC-002`, ...

Every finding must include:

- `severity`
- `dimension`
- at least one evidence item with `file:line` or command output
- a concrete problem statement
- why the issue matters
- a suggested fix that can be turned into an implementation plan

Do not include vague findings such as "improve clarity" without evidence and a concrete fix.

### Deterministic output

- Include raw output only for lines relevant to the audited files.
- If a repo-wide command returns unrelated errors, say they are unrelated and do not count them against the audited page.
- If a command passes, write `No relevant output`.
- If a command cannot run, include the exact command and error message.

### Recommended fix strategy

- Keep this high-level in the audit report.
- Do not edit files during the audit-report step.
- Use `submit_plan` only after the user has seen the report.

### Agent-build eval reporting

After fixes and re-linting, append or produce a follow-up section:

```md
## Agent-build eval results

| Job-to-be-done | Result | Evidence | Follow-up findings |
| --- | --- | --- | --- |
| `$JOB_1` | `passed/blocked/failed` | `$SUMMARY` | `$FINDING_IDS_OR_NONE` |

### Eval notes

- Eval input: improved doc + selected job-to-be-done only.
- Eval artifact directory: `$RUN_DIR/evals/$JOB_SLUG/`
- Eval project path: `$RUN_DIR/evals/$JOB_SLUG/project/`
- Eval setup method: `$DOC_COMMANDS_OR_LOCAL_SCAFFOLD_OR_MINIMAL_PROJECT`
- Local package linking method: `$SCAFFOLD_LINK_OR_FILE_DEPS_OR_PACKAGE_MANAGER_LINK_OR_PUBLISHED_LAST_RESORT`
- Eval environment: `$ENVIRONMENT_SUMMARY`
- Commands log: `$RUN_DIR/evals/$JOB_SLUG/commands.log`
- Result file: `$RUN_DIR/evals/$JOB_SLUG/result.md`
- Doc friction observed: `$DOC_FRICTION_OR_NONE`
- Harness/environment friction observed: `$HARNESS_FRICTION_OR_NONE`
````

When an eval is rerun after a follow-up fix, the table must show the latest outcome and the notes must state where the original failure is preserved. If the latest result is `passed`, do not leave a stale failed result in `result.md`; keep the original failure in `commands.log` or a dated result snapshot.

If the eval finds doc-caused friction, create additional `PRAC-*`, `CODE-*`, or `API-*` findings and return to the fix-plan loop. Do not create follow-up doc findings for package-manager, temp-directory, missing local binary, credential, or other harness/environment friction unless the doc itself caused that friction.

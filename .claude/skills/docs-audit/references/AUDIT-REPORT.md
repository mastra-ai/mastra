# Documentation audit report format

Use this format for every docs-audit report. Present the report before any fix plan or edits.

## Required sections

1. Header
2. Selected jobs-to-be-done
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

Raw output is in `$RUN_DIR/commands/` from `scripts/run-checks.sh`. Include relevant lines only.

### `$COMMAND`

Verdict: `$pass_warn_fail`

```text
$RAW_RELEVANT_OUTPUT_OR_NO_RELEVANT_OUTPUT
```

## Recommended fix strategy

Do not implement yet. If approved, prepare a `submit_plan` fix plan that addresses blocker/major accuracy issues, completeness, practicability, style/lint issues, re-runs checks, and runs mandatory evals.

## Next step

I can convert these findings into an implementation plan for approval.
````

## Rules

Header:

- `Page path`: repository-relative path.
- `Page type`: `docs overview`, `docs standard`, `guide quickstart`, `guide tutorial`, `guide integration`, `guide deployment`, `reference`, or `other`.
- `Packages covered`: doc frontmatter `packages:` plus packages imported in code blocks.
- `Temporary artifact directory`: exact script-printed `$RUN_DIR`.
- `Source paths inspected`: every source directory/file used as evidence.
- `Styleguides applied`: always STYLEGUIDE plus exactly one page-type guide when applicable.

Scores and findings:

- Verdicts are only `pass`, `warn`, or `fail`.
- Finding IDs use `STYLE-001`, `LINT-001`, `CODE-001`, `API-001`, or `PRAC-001` prefixes.
- Every finding includes severity, dimension, evidence, problem, why it matters, and suggested fix.
- Do not include vague findings like "improve clarity" without evidence and a concrete fix.
- Keep deterministic lint separate from styleguide judgment.

Deterministic output:

- Reference `$RUN_DIR/commands/*.txt`.
- Include only audited-file-relevant lines.
- Report unrelated repo-wide failures without counting them against the audited page.
- If a command passes, write `No relevant output`.
- If a command cannot run, include the exact command and error.

## Agent-build eval results

After fixes and re-linting, append or produce a follow-up section:

```md
## Agent-build eval results

| Job-to-be-done | Result | Evidence | Follow-up findings |
| -------------- | ------ | -------- | ------------------ |
| `$JOB_1`       | passed/blocked/failed | `$SUMMARY` | `$FINDING_IDS_OR_NONE` |

### Eval notes

- Eval artifact directory: `$RUN_DIR/evals/$JOB_SLUG/`
- Eval project path: `$RUN_DIR/evals/$JOB_SLUG/project/`
- Eval setup method: value from `setup-method.txt`
- Commands log: `$RUN_DIR/evals/$JOB_SLUG/commands.log`
- Result file: `$RUN_DIR/evals/$JOB_SLUG/result.md`
- Doc friction observed: `$DOC_FRICTION_OR_NONE`
- Harness/environment friction observed: `$HARNESS_FRICTION_OR_NONE`
```

Only doc-caused eval friction becomes follow-up findings. Preserve the original failure in `commands.log`; replace `result.md` with the latest outcome after re-runs.

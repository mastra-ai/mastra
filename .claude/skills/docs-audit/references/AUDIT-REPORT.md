# Documentation audit report format

Use this format for every autonomous docs-audit review. Produce one report and stop without questions, edits, fix-plan submission, or post-fix evaluation.

## Required sections

1. Audit scope
2. Page classification and canonical-guidance compliance
3. Source verification
4. Contextual code-block outcomes
5. Reference completeness
6. Deterministic checks
7. Findings
8. Overall verdict

## Template

```md
# Documentation audit report

## Audit scope

- Base/diff reviewed: `$BASE_OR_USER_SCOPE`
- Authored pages audited:
  - `$DOC_PATH`
- Exclusions or limitations: `$NONE_OR_EXPLANATION`

## Page classification and canonical-guidance compliance

| Page        | Classification  | Canonical references applied                                                                                                   | Compliance       | Notes      |
| ----------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------- | ---------- |
| `$DOC_PATH` | `$PAGE_VARIANT` | `STYLEGUIDE.md`, `INFORMATION_ARCHITECTURE.md`, `AUTHORING_WORKFLOW.md`, `$PAGE_GUIDE`, `$OPTIONAL_COMPONENT_OR_DIAGRAM_GUIDE` | `pass/warn/fail` | `$SUMMARY` |

Record `AUTHORING_WORKFLOW.md` verification guidance for every page. Record its move/delete/redirect guidance only when those operations occur. Include `COMPONENTS.md` when components are used and `DIAGRAM.md` when Mermaid or diagram assets are present.

## Source verification

| Page        | Packages or surfaces               | Source paths inspected     | Outcome                       |
| ----------- | ---------------------------------- | -------------------------- | ----------------------------- |
| `$DOC_PATH` | `$PACKAGE_APIS_ROUTES_OR_COMMANDS` | `$SOURCE_PATH_LINE_RANGES` | `$PASS_WARN_FAIL_AND_SUMMARY` |

## Contextual code-block outcomes

| Page and block    | Role                                                                  | Context supplied by          | Source checks                                  | Outcome                      |
| ----------------- | --------------------------------------------------------------------- | ---------------------------- | ---------------------------------------------- | ---------------------------- |
| `$DOC_PATH:$LINE` | `standalone/incremental/illustrative/configuration-only/shell/output` | `$PROSE_PRIOR_BLOCK_OR_NONE` | `$IMPORTS_SYMBOLS_OPTIONS_ASYNC_PREREQUISITES` | `$PASS_WARN_FAIL_AND_REASON` |

Include every changed page with code. Explicitly record valid intentional omissions and why surrounding prose or prior blocks make them sufficient.

## Reference completeness

| Reference page    | Declared public surface | Exported source checked    | Defaults/optionality/errors/returns | Outcome           |
| ----------------- | ----------------------- | -------------------------- | ----------------------------------- | ----------------- |
| `$REFERENCE_PATH` | `$SURFACE`              | `$SOURCE_PATH_LINE_RANGES` | `$SUMMARY`                          | `$PASS_WARN_FAIL` |

Write `Not applicable` when no reference page is in scope. Do not apply reference-level enumeration to guides or overviews.

## Deterministic checks

- Command: `$EXACT_RUN_CHECKS_COMMAND`
- Audited-target results:
  - `format-target=$STATE`
  - `remark-target=$STATE`
  - `vale-target=$STATE`
  - `validate-target=$STATE`
- Proven unrelated repository-wide failures: `$NONE_OR_SUMMARY`
- Skipped or unavailable checks: `$NONE_OR_EXACT_ERROR`

Include only actionable audited-page diagnostics. Never count proven unrelated repository-wide noise against the page verdict.

## Findings

### `$UNIQUE_FINDING_ID`: `$SHORT_TITLE`

- Severity: `$blocker_major_minor_nit`
- Dimension: `$canonical_guidance_deterministic_code_source_completeness_followability`
- Evidence:
  - Changed doc: `$DOC_PATH:$LINE`
  - Source: `$SOURCE_PATH:$LINE` (when accuracy or completeness is involved)
  - Canonical guide: `$GUIDE_PATH:$LINE` (when guidance is involved)
  - Deterministic command: `$COMMAND` (when a check is involved)
- Problem: `$PRECISE_CONTRADICTION_OR_OMISSION`
- Impact: `$READER_OR_MAINTAINER_EFFECT`
- Bounded remediation: `$SMALLEST_CORRECTIVE_DIRECTION`

Repeat once per distinct issue. Do not duplicate one issue under multiple IDs.

If there are no findings, write `No findings.`

## Overall verdict

- Verdict: `pass/warn/fail`
- Blockers: `$COUNT`
- Major: `$COUNT`
- Minor: `$COUNT`
- Nit: `$COUNT`
- Summary: `$ONE_PARAGRAPH_CONCLUSION`
```

## Rules

- Page classifications are only `docs overview`, `docs page`, `integration`, `deployment integration`, or `reference`.
- Verdicts are only `pass`, `warn`, or `fail`.
- Finding IDs are unique within the report and stable enough to discuss individually.
- Every finding includes changed-doc evidence plus source or canonical-guide evidence when applicable.
- Findings must describe a concrete contradiction or unmet rule, not a vague preference.
- Contextual code outcomes distinguish intentional partial snippets from genuinely missing context.
- Reference completeness is bounded by the page's declared public surface and exported API.
- Deterministic target failures and unrelated repository-wide failures stay separate.
- The report contains no temporary artifact path, interactive job-selection workflow, implementation plan, or post-audit repair or execution section.
- Stop after the report.

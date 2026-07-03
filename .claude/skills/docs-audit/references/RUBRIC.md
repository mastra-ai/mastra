# Documentation audit rubric

Audit Mastra docs against source code, deterministic checks, styleguides, and practical followability. Every finding needs `file:line` evidence; source-backed findings need both doc and source locations. Keep deterministic lint separate from judgment findings.

## Scales

Verdicts:

- `pass`: No material issues for the dimension.
- `warn`: Minor/moderate issues reduce quality or confidence, but the page remains usable.
- `fail`: Major issues make the page inaccurate, incomplete, misleading, invalid, or not followable.

Severity:

- `blocker`: Cannot be safely followed or published.
- `major`: Materially inaccurate, incomplete, or likely to cause failed implementation.
- `minor`: Usable, but clarity/confidence/maintainability suffers.
- `nit`: Small wording, formatting, or consistency issue.

## Dimensions

### 1. Styleguide adherence

Type: judgment, cross-referenced with deterministic linting.

Apply `.claude/skills/mastra-docs/references/STYLEGUIDE.md` and the matching page-type guide from the `mastra-docs` skill. Do not duplicate their rules here; cite the specific guide/section for style findings.

- `pass`: No styleguide or page-shape issues.
- `warn`: Minor wording, structure, or formatting issues.
- `fail`: Repeated violations, missing required page-type sections, incorrect reference structure, or style issues that hurt followability.

### 2. Deterministic linting

Type: deterministic.

Use `scripts/run-checks.sh`; it captures validation, remark, Vale, and file-scoped Prettier output in `$RUN_DIR/commands/`.

Check relevant output for:

- frontmatter/sidebar validation failures,
- remark structure errors,
- Vale error-level prose issues,
- Prettier formatting failures.

- `pass`: Checks pass or produce no output relevant to audited files.
- `warn`: A tool cannot run for environmental reasons, such as missing local Vale setup.
- `fail`: Any relevant validation, lint, or formatting error exists for audited files.

### 3. Code example accuracy

Type: judgment against source.

Use package source, TypeScript definitions, real exports, and `docs/src/plugins/remark-model-tokens/models.ts` as truth. Check fenced code blocks for:

- real package imports and relative files,
- existing classes/functions/methods/properties,
- correct options, required fields, async usage, signatures, and return types,
- realistic TypeScript inference for generic/overload-heavy APIs, including literal IDs, registry keys, version selectors, and constructor options,
- page-type-appropriate completeness,
- `new Agent()` examples including `id`, `name`, `instructions`, and `model`,
- model placeholders instead of literal model IDs,
- no reliance on undocumented setup unless stated.

- `pass`: Examples match source and are complete enough for the page type.
- `warn`: Technically plausible but missing small context or explanation.
- `fail`: Stale imports/APIs, wrong options/signatures, missing required fields, literal model IDs, or incomplete quickstart/tutorial code.

### 4. API/property completeness

Type: judgment against source.

Strictest for reference pages, but applies wherever a page claims to cover a feature surface. Check that documented parameters, properties, methods, events, defaults, nested objects, constraints, and return values match exported source APIs.

Also flag:

- relevant public members missing from docs,
- documented members absent from source,
- wrong required/optional labels,
- reference methods without real examples,
- `<PropertiesTable>` entries missing `name`, `type`, or `description`,
- missing edge cases needed for correct use.

- `pass`: Page-scope API surface aligns with source.
- `warn`: Small omissions/defaults that do not block common use.
- `fail`: Missing required properties, stale APIs, incomplete reference coverage, wrong optionality, or missing method examples.

### 5. Practicability

Type: judgment and eval-backed.

Use the selected jobs-to-be-done. Check whether a beginner or isolated agent can complete each job from the doc alone.

Look for:

- missing prerequisites/imports/configuration,
- ambiguous steps or undefined jargon,
- missing expected output or verification,
- snippets that cannot be assembled into working code,
- hidden credential/service/deployment assumptions,
- TypeScript-copyability issues in examples that teach inference-sensitive behavior.

After approved fixes, mandatory eval results can upgrade, downgrade, or add findings. Separate doc-caused friction from harness/environment friction.

- `pass`: Selected jobs are followable and evals pass or reach only explicit external boundaries.
- `warn`: Minor friction or harness/environment limitation, but job remains reasonably followable.
- `fail`: Missing/incorrect instructions block a selected job, or eval fails for doc-caused reasons.

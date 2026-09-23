# Documentation audit rubric

Use this rubric with the canonical `mastra-docs` references. Those references own authoring rules; this rubric owns audit evidence, severity, verdicts, contextual code review, and source-completeness expectations.

Every finding requires changed-doc `file:line` evidence. Accuracy findings also require source `file:line` evidence. Guidance findings require the applicable canonical-guide `file:line` evidence. Keep deterministic findings separate from judgment findings and proven unrelated repository noise.

## Verdicts and severity

Verdicts:

- `pass`: No material issue in the audited scope.
- `warn`: A minor issue or verification limitation reduces confidence without making the page misleading or unusable.
- `fail`: The page is materially inaccurate, incomplete, unsafe, structurally wrong, or not followable.

Severity:

- `blocker`: Unsafe to publish or follow.
- `major`: Likely to mislead readers or cause a failed implementation.
- `minor`: The page remains usable, but accuracy, clarity, completeness, or maintainability suffers.
- `nit`: Small localized consistency issue with no material effect.

## Required canonical-guidance coverage

For every page apply and record:

- `STYLEGUIDE.md`
- `INFORMATION_ARCHITECTURE.md`
- verification guidance from `AUTHORING_WORKFLOW.md`
- the applicable page guide: `DOC.md`, `GUIDE_INTEGRATION.md`, or `REFERENCE.md`
- `COMPONENTS.md` when shared MDX or llms-txt-aware components are present
- `DIAGRAM.md` when Mermaid or diagram assets are present

Use the move, delete, and redirect guidance in `AUTHORING_WORKFLOW.md` only when those operations occur in the reviewed scope.

## Page variants

### Docs overview

Verify broad orientation, canonical ownership, hierarchy, component-driven navigation, and useful next steps under `DOC.md`. Source-check APIs and behavior the overview teaches, but do not require reference-level enumeration.

### Docs page

Verify the page teaches one coherent concept or task with sufficient prerequisites, ordered instructions, expected results or verification, and related navigation under `DOC.md`. Source-check every technical claim and API used.

### Integration

Verify installation and setup, package/import correctness, provider-specific prerequisites, task or recipe flow, verification, and integration navigation under `GUIDE_INTEGRATION.md`.

### Deployment integration

Apply the integration checks plus deployment concerns: authentication before public exposure, reproducible commands, environment and secret names, production dependencies, scaling assumptions, and operational verification.

### Reference

Apply `REFERENCE.md` and compare the page's declared public surface with package exports, public types, implementation, and tests. Verify parameters, properties, overloads, defaults, optionality, constraints, errors, return values, examples, and relevant public members. Do not demand internal details outside the declared API surface.

## Audit dimensions

### 1. Canonical-guidance compliance

Type: judgment against `mastra-docs`.

Check information architecture, page shape, writing, links, components, diagrams, accessibility, and applicable authoring workflow. Cite the specific canonical guide rather than copying its rule into this rubric.

- `pass`: The page follows all applicable canonical guidance.
- `warn`: A localized issue reduces clarity or maintainability.
- `fail`: Structure, ownership, component, diagram, accessibility, or writing problems materially hurt accuracy or followability.

### 2. Deterministic checks

Type: deterministic.

Use `scripts/run-checks.sh` for audited-page formatting, Remark, Vale, and repository validation. Attribute only output tied to an audited path, doc ID, or route to the page. Report missing tools or ambiguous attribution as `warn`; report proven unrelated failures separately.

- `pass`: No audited-target error.
- `warn`: A check could not run or repository validation attribution is ambiguous.
- `fail`: A deterministic error is attributable to an audited page.

### 3. Contextual code accuracy

Type: judgment against source and surrounding page context.

Classify every block as standalone, incremental, illustrative, configuration-only, shell, or output. Require only the context appropriate to that role. Adjacent prose and prior blocks may supply intentional omissions.

Verify imports, exports, symbols, options, required fields, defaults, constraints, async behavior, return behavior, prerequisites, commands, and expected results. A partial snippet is not automatically invalid; explain why its context is sufficient or what specific missing context makes it misleading.

- `pass`: Each block is accurate and complete enough for its role.
- `warn`: A small contextual omission creates friction but does not teach incorrect behavior.
- `fail`: The page teaches stale, invalid, misleading, or unusable code or commands.

### 4. Source and public-surface completeness

Type: judgment against exported source.

Apply strict completeness to reference pages and proportional completeness elsewhere. References must match the declared exported API surface, including defaults, optionality, errors, constraints, overloads, and return behavior. Guides and overviews need source support for claims and APIs they teach, not exhaustive API catalogs.

- `pass`: The claimed surface aligns with exported source.
- `warn`: A non-blocking default or edge case is omitted.
- `fail`: Required public behavior is missing, stale, wrongly typed, or contradicted by the page.

### 5. Followability

Type: contextual judgment.

Derive the tasks promised by the page without asking the user to select them. Check prerequisites, sequence, jargon, credentials, external-service boundaries, expected outcomes, verification, and consistency across prose and examples. Do not create temporary projects or require independent compilation of every block.

- `pass`: A reader can complete the promised task or understand the promised surface from the page and its explicit prerequisites.
- `warn`: Minor friction remains, but the task is reasonably followable.
- `fail`: Missing or incorrect instructions block the promised task or create an unsafe result.

## Finding quality

A valid finding has one unique ID and contains:

- severity and dimension
- changed-doc `file:line`
- source or canonical-guide `file:line` when applicable
- the precise contradiction or missing requirement
- reader impact
- a bounded remediation

Do not report generic preferences, duplicate one issue under multiple IDs, or treat unrelated repository failures as page findings.

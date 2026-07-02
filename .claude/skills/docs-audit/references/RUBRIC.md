# Documentation audit rubric

Use this rubric to audit Mastra documentation against source code, deterministic checks, existing styleguides, and practical followability.

Each finding must cite evidence with `file:line`. For source-backed claims, cite both the doc location and the source location. Keep deterministic checks separate from judgment checks in the report.

## Verdict scale

- `pass`: No material issues found for this dimension.
- `warn`: One or more minor or moderate issues reduce quality, clarity, or confidence, but the page remains usable.
- `fail`: One or more major issues make the page inaccurate, incomplete, misleading, invalid, or not followable.

## Severity scale

- `blocker`: The doc cannot be safely followed or published in its current state.
- `major`: The doc is materially inaccurate, incomplete, or likely to cause failed implementation.
- `minor`: The doc is usable, but a gap or style issue reduces clarity, confidence, or maintainability.
- `nit`: A small wording, formatting, or consistency issue.

## Dimensions

### 1. Styleguide adherence

Type: judgment, cross-referenced with deterministic linting.

Primary references:

- `.claude/skills/mastra-docs/references/STYLEGUIDE.md`
- Matching page-type guide:
  - `docs/src/content/en/docs/**`: `.claude/skills/mastra-docs/references/DOC.md`
  - `docs/src/content/en/guides/getting-started/**`: `.claude/skills/mastra-docs/references/GUIDE_QUICKSTART.md`
  - `docs/src/content/en/guides/**/deployment/**` or deployment pages: `.claude/skills/mastra-docs/references/GUIDE_DEPLOYMENT.md`
  - tutorial-style guide pages: `.claude/skills/mastra-docs/references/GUIDE_TUTORIAL.md`
  - integration-style guide pages: `.claude/skills/mastra-docs/references/GUIDE_INTEGRATION.md`
  - `docs/src/content/en/reference/**`: `.claude/skills/mastra-docs/references/REFERENCE.md`

Check:

- Load and apply `.claude/skills/mastra-docs/references/STYLEGUIDE.md` as the source of truth for general prose, heading, terminology, code-block, and model-token rules.
- Load and apply the matching page-type guide as the source of truth for required page shape, frontmatter, sections, components, and example patterns.
- Cite the specific source guide and section or line range for each style finding.
- Do not copy the styleguide's rule list into this rubric. If the styleguide changes, the audit must follow the updated source guide.

Verdict guidance:

- `pass`: No styleguide or page-shape issues found.
- `warn`: Minor wording, structure, or formatting issues that do not block comprehension.
- `fail`: Repeated styleguide violations, missing required page-type sections, incorrect reference structure, or style issues that make the page hard to follow.

### 2. Deterministic linting

Type: deterministic.

Run from `docs/` unless a command explicitly supports file arguments:

- `pnpm validate`
- `pnpm lint:remark`
- `pnpm lint:vale:ai`
- Prettier check for the audited file(s). Prefer a check command over writing changes during audit, for example `pnpm exec prettier --check <file>`.

Check:

- Frontmatter and sidebar validation pass.
- Remark has no markdown structure errors for the audited page.
- Vale AI lint has no error-level prose issues for the audited page.
- Prettier reports the audited file as formatted.
- Raw command output is captured and filtered to audited files when repo-wide commands are required.

Verdict guidance:

- `pass`: All deterministic checks pass or produce no output relevant to the audited files.
- `warn`: A tool cannot run for an environmental reason, such as Vale not being installed; report it as skipped with the command and error.
- `fail`: Any relevant linter, formatter, frontmatter, or sidebar error exists for the audited files.

### 3. Code example accuracy

Type: judgment against source.

Source of truth:

- Doc frontmatter `packages:` list.
- `@mastra/<name>` imports in fenced code blocks.
- Package source under the workspace package's `src` directory. Start with `packages/<name>/src`; if it does not exist, find the workspace `package.json` whose `name` is `@mastra/<name>` and use that package's `src` directory.
- TypeScript definitions, exported classes, functions, constructors, method signatures, and option types from source.
- Model placeholder tokens from `docs/src/plugins/remark-model-tokens/models.ts`.

Check each fenced code block:

- Imports resolve to real package exports or real relative files created earlier in the page.
- Package names in examples exist in the repository.
- Constructor names, method names, function names, and property names exist in source.
- Constructor and function options match actual TypeScript types.
- Method signatures, return types, and async usage match source.
- Example snippets are complete enough for their page type. Quickstarts and tutorials need complete, copyable code; reference pages can use focused snippets but must be real.
- Any `new Agent()` example includes at least `id`, `name`, `instructions`, and `model`.
- Model names and IDs use placeholder tokens from `docs/src/plugins/remark-model-tokens/models.ts`, not literal model IDs.
- Example code does not rely on undocumented setup unless the page states it.

Verdict guidance:

- `pass`: Examples match source and are complete for the page type.
- `warn`: Examples are technically plausible but omit small context, titles, or explanations.
- `fail`: Examples contain stale imports, nonexistent APIs, wrong option names, invalid signatures, missing required `new Agent()` fields, literal model IDs, or incomplete quickstart/tutorial code.

### 4. API/property completeness

Type: judgment against source.

Applies most strictly to reference pages, but also applies to docs pages that claim to cover a complete feature surface.

Check:

- The documented parameters, properties, methods, events, and return values match the actual exported TypeScript API.
- Public exported members relevant to the page are not missing.
- Documented members that no longer exist are flagged as stale.
- Required and optional fields are labeled correctly.
- Defaults are documented when source exposes meaningful defaults or docs rely on default behavior.
- Nested option objects are documented with `<PropertiesTable>` patterns where reference docs require them.
- Every reference-page method has at least one real code example.
- Every `<PropertiesTable>` entry includes `name`, `type`, and `description`.
- Domain-specific behavior, constraints, and important edge cases are linked or summarized when needed to use the API correctly.

Verdict guidance:

- `pass`: Documented API surface aligns with source for the page scope.
- `warn`: Small omissions or missing defaults that do not block common usage.
- `fail`: Missing required properties, stale documented APIs, incomplete reference coverage, wrong optionality, or missing method examples.

### 5. Practicability

Type: judgment and eval-backed.

Use the jobs-to-be-done selected by the user from agent-generated options. The user should not have to invent these jobs. Derive 2–4 candidate jobs from the doc's title, intro, headings, code examples, and intended page type, then ask the user to select which jobs to check.

#### Beginner-can-do

Check:

- Prerequisites are explicit and appropriate for the page type.
- Required accounts, API keys, packages, versions, files, environment variables, and existing project state are stated before use.
- Jargon is defined or linked on first use.
- Steps are ordered so a new reader does not need future knowledge.
- Each action has a clear target file, command, or UI location.
- The page includes a way to verify success when the page type expects one, such as `Test your $THING` or `Test the $THING`.
- Expected outputs are stated, including when model responses may vary.
- Links resolve to relevant next steps, reference docs, or external docs instead of creating dead ends.

#### Agent-can-build

Check:

- For each selected job-to-be-done, an agent can complete the task using only the improved doc plus normal repository/tool access.
- The doc gives enough inputs and constraints to avoid guessing.
- The doc distinguishes required steps from optional variations.
- The doc includes complete code when the job requires code.
- Ambiguous choices are explained or constrained.
- Any agent-build eval friction is converted into findings with evidence from the failed or blocked step.

Verdict guidance:

- `pass`: A beginner can follow the doc, and the mandatory agent-build eval completes the selected job(s) without doc-caused blockers.
- `warn`: The doc is mostly followable, but the eval or judgment review finds minor ambiguity, missing context, or avoidable friction.
- `fail`: The selected job cannot be completed from the doc, the eval gets blocked by missing or wrong instructions, or a beginner would need unstated knowledge to proceed.

## Reporting rules

- Cite `file:line` evidence for every finding.
- Keep deterministic findings separate from judgment findings in the score table.
- Do not propose edits until the audit report has been presented.
- Treat source code as the source of truth for accuracy and completeness.
- If source and docs conflict, flag the docs unless the source appears internally inconsistent; then flag the uncertainty explicitly.
- Store raw command output, doc snapshots, and eval project artifacts in the temporary run directory, not in the repository worktree.
- If a doc rename or deletion is recommended, include the `vercel.redirects.json` requirement in the finding or fix plan.

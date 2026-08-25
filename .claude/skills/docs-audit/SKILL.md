---
name: docs-audit
description: Autonomous, report-only documentation review for Mastra docs. Use when auditing changed docs against source, validating contextual code examples or API coverage, checking canonical mastra-docs guidance, or running narrow deterministic checks.
---

# Documentation audit

Audit Mastra documentation autonomously against source, the canonical `mastra-docs` guidance, and narrow deterministic checks. This skill is for report-only reviews. Do not edit documentation, ask the user to select jobs, or submit a fix plan unless the user separately requests implementation after the audit.

## Load first

1. Activate the `mastra-docs` skill. Its references are the canonical authoring policy; do not restate their rules.
2. Read:
   - `references/RUBRIC.md`
   - `references/AUDIT-REPORT.md`
   - `.claude/skills/mastra-docs/references/STYLEGUIDE.md`
   - `.claude/skills/mastra-docs/references/INFORMATION_ARCHITECTURE.md`
   - `.claude/skills/mastra-docs/references/AUTHORING_WORKFLOW.md`
3. Add the applicable canonical references:
   - `/docs` pages: `DOC.md`
   - `/integrations` pages: `GUIDE_INTEGRATION.md`
   - `/reference` pages: `REFERENCE.md`
   - pages using shared MDX or llms-txt-aware components: `COMPONENTS.md`
   - pages containing Mermaid or diagram assets: `DIAGRAM.md`

Apply the verification rules in `AUTHORING_WORKFLOW.md` to every audit. Apply its move, delete, and redirect sections only when those operations are part of the reviewed diff.

## Autonomous workflow

### 1. Determine the complete audit scope

Use the explicit files, URL, topic, or PR named by the user. Otherwise inspect the current PR/diff and include every changed authored page under:

- `docs/src/content/en/docs`
- `docs/src/content/en/integrations`
- `docs/src/content/en/reference`

Do not ask the user to choose pages or jobs. Do not silently sample or cap a large changed-page set. Exclude generated pages unless the diff changes their generator or generated contract. Record any unavailable or ambiguous scope as a report limitation instead of starting a question loop.

### 2. Classify every page and map canonical guidance

Use these classifications:

- `docs overview`: `/docs/**/overview.mdx` and overview-shaped `/docs/index.mdx`
- `docs page`: other authored `/docs/**` pages
- `deployment integration`: `/integrations/deploy/**`
- `integration`: other authored `/integrations/**`
- `reference`: authored `/reference/**`

Prefer content and canonical ownership when a filename is misleading. For each page, record a compliance map with its classification and every canonical reference applied. Always include `STYLEGUIDE.md`, `INFORMATION_ARCHITECTURE.md`, and the verification guidance in `AUTHORING_WORKFLOW.md`, then add the page-type, component, and diagram references that apply.

### 3. Plan a bounded evidence pass

Keep the audit complete without repeating work:

- Inspect the changed-file list and one focused diff before reading pages. Do not rerun equivalent diff commands per file.
- Read each page in the largest practical contiguous chunks and batch independent page or source reads.
- Load each canonical reference once. Do not reread its `docs/styleguides` symlink or another alias.
- Do not create a task list for an audit-only review.
- For guides and overviews, source-check changed claims and the code or behavior the page teaches; do not re-verify unrelated unchanged vendor behavior.
- For references, still perform the complete declared-surface comparison required below.
- Use current source and exports before history. Use an architecture expert only when a material ambiguity remains after the narrow source read.
- Browse external documentation only when a changed claim depends on vendor behavior that cannot be verified in the repository. Use the narrowest authoritative source and do not broaden into a general vendor-doc audit.

Complete source and guidance research before deterministic checks. After the checker finishes, synthesize the report immediately; do not start new research unless the checker exposes a new audited-target failure.

### 4. Establish source truth narrowly

Collect the page's frontmatter packages, imports, commands, environment variables, APIs, options, defaults, properties, errors, return values, components, diagrams, and route claims.

Resolve packages through workspace `package.json` exports. Inspect the narrow exported implementation, public types, and tests needed to verify each claim. Use history only when current ownership or intended behavior cannot be established from current source. Existing docs are context, not proof.

Cite changed-doc `file:line` evidence for every finding. Accuracy findings also cite source `file:line`; guidance findings cite the canonical guide `file:line` that establishes the rule.

### 5. Verify every code block contextually

Classify each block as one of:

- standalone
- incremental
- illustrative
- configuration-only
- shell
- output

Judge completeness for that role and the surrounding page. Adjacent prose, imports, setup sections, or prior blocks may intentionally provide omitted context. Do not require every block to compile independently and do not flag a fragment merely because it is partial.

Verify what the block does teach against source:

- package and relative imports
- exported symbols and method names
- options, required fields, defaults, and constraints
- async/await and return behavior
- prerequisites, credentials, services, and environment setup
- consistency with adjacent blocks and stated expected results

Report a contextual block outcome for every changed page, including valid intentional omissions and why the surrounding context makes them sufficient.

### 6. Check page-specific completeness

Apply `references/RUBRIC.md` and the canonical page guide:

- Docs overviews: verify broad orientation, canonical ownership, component-driven navigation, and next-step coverage without demanding an API catalog.
- Docs pages: verify the concept or task taught, its prerequisites, sequence, expected results, and related navigation.
- Integrations: verify installation/setup, imported package and provider behavior, recipes or task flow, and integration-specific prerequisites.
- Deployment integrations: additionally verify authentication and exposure ordering, production prerequisites, commands, environment values, and operational verification.
- References: compare the declared public surface with exported APIs. Check every claimed parameter, property, overload, default, optional field, constraint, error, return value, and example. Flag missing public surface within the page's declared scope, but not internal implementation details.

Guides and overviews still require source verification for APIs and behavior they teach; they are not forced into reference-page completeness.

### 7. Run narrow deterministic checks

Run the docs-audit checker once for all changed pages. During the current transition, its output directory is ephemeral and is not part of the report contract:

```sh
CHECK_DIR="$(mktemp -d)"
trap 'rm -rf "$CHECK_DIR"' EXIT
bash .claude/skills/docs-audit/scripts/run-checks.sh \
  --run-dir "$CHECK_DIR" \
  --docs <all-audited-files>
cat "$CHECK_DIR/commands/summary.txt"
```

Read the summary first. Treat `*-target` entries as audited-page results. Report proven unrelated repository-wide failures separately and never count them against an audited page. Do not run write-formatting, package installation, temporary project setup, or code-example eval projects.

### 8. Report and stop

Produce one final report using `references/AUDIT-REPORT.md`. Include:

- complete scope and limitations
- per-page classification and canonical-guidance compliance map
- source paths inspected
- contextual outcome for every code block or page-level code set
- strict reference completeness outcomes where applicable
- deterministic target results and separate repo-wide noise
- uniquely identified, source-backed findings ordered by severity
- an overall verdict

Do not ask follow-up questions, edit files, submit a plan, or run post-fix checks. Stop after the report. If the user later requests fixes, treat that as a separate implementation task under `mastra-docs`.

## Rules

- Audit every changed authored page in scope
- Keep `mastra-docs` as the sole owner of authoring rules
- Treat source and exported types as truth
- Use narrow evidence-driven reads rather than broad source archaeology
- Verify code in page context, not through blanket independent compilation
- Keep reference completeness bounded by the page's declared public surface
- Separate deterministic target failures from unrelated repository noise
- Never modify the repository during an audit-only request

## References

- references/AUDIT-REPORT.md
- references/RUBRIC.md

## Scripts

- scripts/run-checks.sh

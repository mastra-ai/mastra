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

- Use one command over the three authored content directories to collect both the changed-file list and a focused diff. Treat changed hunks and their page-level consequences as the primary risk map; do not retry with glob variants or rerun equivalent diff commands per file.
- Read each page once in the largest practical contiguous chunks and retain its line numbers for citations. Do not separately search for code fences or reread ranges for citations; reread only when tool truncation hid required evidence.
- Do not inspect sidebars unless a sidebar changed or route ownership is genuinely ambiguous from the page path and content.
- Load each canonical reference once. Batch independent canonical-reference and page reads with `multi_tool_use.parallel`, but keep each parallel batch to at most two files and 500 requested lines so results remain directly usable. Never batch all references or all pages into one response, issue every read serially, or reread a `docs/styleguides` symlink or another alias.
- Do not create a task list for an audit-only review.
- Build one batched alternation from exact imported/exported identifiers and disputed literals across all changed pages, then search the full repository once with no context and a small per-file match cap. Omit generic words, broad option names, and already-proven prose terms so the result identifies source paths without flooding the audit. Do not guess package subtrees, begin with one search per page or symbol, or use file discovery unless that full-repository search returns no usable path.
- Group related pages, blocks, imports, and symbols into shared source reads. Once the batched search identifies source paths and line evidence, open independent implementation ranges together with `multi_tool_use.parallel`, keeping each range under 150 lines and each batch under 500 requested lines. Do not open full implementation files, issue serial source reads, or run discovery commands between the search and those reads.
- After scope, guidance, and page reads, default to no more than two focused source lookup operations per changed page. Exceed that only to resolve a material ambiguity or complete a reference surface, and batch the additional evidence.
- For guides and overviews, source-check changed claims and the code or behavior the page teaches; do not re-verify unrelated unchanged vendor behavior.
- For references, still perform the complete declared-surface comparison required below.
- Use current source and exports before history. Do not search tests or history after the exported implementation already proves the claim. Do not call an architecture expert during a docs audit: the report requires current `file:line` source evidence, and an expert response cannot replace it.
- Never call conversation recall, web search, browser tools, or external search during a repository audit. If a tool result is truncated, rerun the same repository read with narrower line ranges instead of recalling prior tool output. Repository source is authoritative for Mastra APIs and components; record any genuinely unverifiable external claim as a limitation instead of browsing.

Complete source and guidance research before deterministic checks. After the checker finishes, synthesize the report immediately; do not start new research unless the checker exposes a new audited-target failure.

### 4. Establish source truth narrowly

For guides and overviews, collect the changed claims plus the minimum page-level context needed to judge their imports, commands, APIs, options, components, diagrams, and prerequisites. Do not inventory every unchanged API or vendor operation on the page. For references, collect the complete declared public surface, including parameters, defaults, optionality, errors, and returns.

Resolve packages through workspace `package.json` exports when package ownership is unclear. Inspect the narrow exported implementation or public type needed to verify each finding candidate, and stop once the claim is proven. Do not inspect tests, package manifests, or adjacent implementations unless the public implementation leaves a material gap. Use history only when current ownership or intended behavior cannot be established from current source. Existing docs are context, not proof.

Cite changed-doc `file:line` evidence for every finding. Accuracy findings also cite source `file:line`; guidance findings cite the canonical guide `file:line` that establishes the rule.

### 5. Verify every code block contextually

Classify each block as one of:

- standalone
- incremental
- illustrative
- configuration-only
- shell
- output

Judge completeness for that role and the surrounding page. Adjacent prose, imports, setup sections, or prior blocks may intentionally provide omitted context. Do not require every block to compile independently and do not flag a fragment merely because it is partial. Group unchanged blocks that share setup and API surfaces into one contextual outcome. Source-check changed blocks and unchanged blocks whose correctness is necessary to judge a changed claim; for other unchanged blocks, use the package/source evidence already established for the page instead of opening new source solely to re-audit unchanged code.

Verify what the relevant block set teaches against source:

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

Run the read-only docs-audit checker once for all changed pages:

```sh
bash .claude/skills/docs-audit/scripts/run-checks.sh \
  --docs <all-audited-files>
```

Invoke the documented command directly; do not inspect the checker source before or after running it. Use the diagnostics and five summary lines printed to stdout. Treat `*-target` entries as audited-page results. Report proven unrelated repository-wide failures separately and never count them against an audited page. Treat `validate-target=warn` as ambiguous attribution that needs report context, not as a target failure or a clean pass. Do not run write-formatting, package installation, temporary project setup, code-example eval projects, or ad hoc compiler/parser probes.

### 8. Report and stop

Produce one compact final report using `references/AUDIT-REPORT.md`. Use one row per page where possible, group code blocks that share a role and evidence, and keep each finding to the evidence, contradiction, impact, and bounded direction needed to act. Include:

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

Use @styleguides/STYLEGUIDE.md first. Read neighboring pages, the relevant sidebar, and source or tests before editing. Prefer the canonical page over overlapping guidance.

Content families:

- src/content/en/docs (/docs): Product documentation
- src/content/en/integrations (/integrations): External integrations and deployment platforms
- src/content/en/reference (/reference): API and configuration reference
- src/content/en/models (/models): Generated; do not edit manually

Relevant guidance:

- @styleguides/INFORMATION_ARCHITECTURE.md: Content ownership and routes
- @styleguides/DOC.md: All /docs page types
- @styleguides/GUIDE_INTEGRATION.md: All /integrations pages
- @styleguides/REFERENCE.md: Reference pages
- @styleguides/COMPONENTS.md
- @styleguides/DIAGRAM.md: Mermaid diagram style and accessibility
- @styleguides/AUTHORING_WORKFLOW.md
- @styleguides/CHECKS.md: `pnpm check` usage, rule IDs, and inline `lint` comments for disabling rules
- @CONTRIBUTING.md: Setup, frontmatter, and MDX syntax
- .claude/skills/docs-diagrams: Existing image-to-Mermaid conversions

Use model tokens from src/plugins/remark-model-tokens/models.ts for model names and IDs.

Follow @styleguides/AUTHORING_WORKFLOW.md for operational commands and checks.

After editing docs, run `pnpm check <changed .mdx files>` from `docs/` and fix every error. It runs frontmatter, sidebar, structure, link, prose (Vale), formatting, and redirect checks in one command. Use `pnpm check --fix` for fixable findings, `--format json` for machine-readable output, and `--only <category>` or `--rule <id>` to narrow the run. The older `validate:*`, `lint:*`, and `format:check` scripts still work but are not needed.

Externally synced docs:

- Each directory in `../.github/docs-sync.json` (for example `src/mastra-code`) is pushed to another docs site's repo whenever it changes on `main`. Edit those pages here; edits in the target repo are overwritten.
- Links in those pages use the target site's routes (for example `/reference#…`), not this site's.
- Each synced directory owns its `sidebars.js`. Add every new page there.
- Validate them with the unscoped `pnpm check` or `pnpm check --rule 'mastra/external-*'`. File-scoped `pnpm check <file>` only accepts `src/content/en` pages.
- Deleting or renaming a synced page breaks inbound links to it, because synced directories have no redirects.
- To add a site, add a manifest entry, install the Dane GitHub App on its repo, and remove any build-time docs fetching there.

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

# Shared self-review checklist

Run these checks on every new or rewritten page, then run the checklist in the page type's template. Each item is a yes/no question. Fix the page until every applicable answer is yes.

## Frontmatter

- [ ] Does the frontmatter include `title`, `description`, and `packages`?
- [ ] Does `packages` follow `docs/CONTRIBUTING.md`: the package that owns the documented API, `@mastra/core` only for broader framework guides or core-owned APIs, the shared interface package on adapter overviews, and four entries or fewer?
- [ ] Does the `description` summarize what readers will understand or accomplish, without repeating the title?
- [ ] Does the title follow the template's title grammar and the established pattern of neighboring pages?

## Content

- [ ] Does the page open by stating what the subject is or what readers will achieve, before any detail?
- [ ] Is every technical claim checked against source, public types, package exports, or tests, not only existing docs?
- [ ] Are all placeholders such as `$NAME`, `$CATEGORY`, and `<path>` replaced?
- [ ] Were template sections that don't apply removed instead of left empty?

## Code

- [ ] Does every code block have a language, such as `typescript`, `bash`, `json`, or `mdx`?
- [ ] Do code blocks that represent a file in the reader's project have a `title="<path>"` attribute?
- [ ] Do package install commands use `bash npm2yarn`?
- [ ] Do model names and IDs use tokens from `docs/src/plugins/remark-model-tokens/models.ts`, such as `__GATEWAY_OPENAI_MODEL__`, instead of literal model IDs?
- [ ] Are imports, option names, defaults, and environment variables current?

## Components and links

- [ ] Are components used only as `references/COMPONENTS.md` describes, with imports for `Steps`, `StepItem`, `Tabs`, `TabItem`, and `CardGrid`?
- [ ] Are admonitions limited to scope notes, warnings, and maturity labels, not routine instructions?
- [ ] Are internal links root-relative and pointing at final canonical routes?
- [ ] Is each API or concept linked on its first mention when a canonical page exists?
- [ ] If the page ends with follow-up links, are they selected links under `## Related` or `## Next steps`, not a copy of the sidebar?

## Placement

- [ ] Does the page live in the content family that owns the subject, as `references/INFORMATION_ARCHITECTURE.md` describes?
- [ ] Is the page added to the matching `sidebars.js`, and are redirects added for any moved or deleted route?

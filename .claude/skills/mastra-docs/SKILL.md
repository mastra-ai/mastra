---
name: mastra-docs
description: Documentation guidelines for Mastra. Use this skill when creating, editing, moving, deleting, or reviewing Mastra documentation, sidebars, redirects, or docs components.
---

# Mastra documentation guidelines

Follow the most specific `AGENTS.md` and use these references:

1. `references/STYLEGUIDE.md`: ISO 24495-1 plain-language principles, accuracy, links, code, and accessibility.
2. `references/INFORMATION_ARCHITECTURE.md`: Content families, canonical ownership, sidebars, and routes.
3. Choose the page guide:
   - `references/DOC.md`: Pages under `/docs`.
   - `references/GUIDE_INTEGRATION.md`: Pages under `/integrations`.
   - `references/REFERENCE.md`: Pages under `/reference`.
4. `references/COMPONENTS.md`: Shared MDX components and llms-txt markup.
5. `references/DIAGRAM.md`: Mermaid diagram shapes, colors, layout, labels, and accessibility.
6. `references/AUTHORING_WORKFLOW.md`: Editing, moves, deletions, redirects, and verification.

To replace an existing diagram image with Mermaid, use the `docs-diagrams` skill.

## Page templates

When creating a page, pick the template that matches the reader's question:

| Reader question                                    | Template                     | Typical location                             |
| -------------------------------------------------- | ---------------------------- | -------------------------------------------- |
| "What is this area, and which option fits?"        | `templates/overview.md`      | `/docs/<category>/overview`                  |
| "What is this capability, and how does it behave?" | `templates/concept.md`       | `/docs/<category>/<feature>`                 |
| "How do I install, connect, or configure this?"    | `templates/setup.md`         | `/docs/<category>/<setup-topic>`             |
| "How do I accomplish this specific task?"          | `templates/how-to.md`        | `/docs/<category>/<task>`                    |
| "What's the fastest way to see it working?"        | `templates/quickstart.md`    | `## Quickstart` in an overview or setup page |
| "What does this API accept and return?"            | `templates/reference-api.md` | `/reference/<category>/<api>`                |
| "What does this command and its flags do?"         | `templates/reference-cli.md` | `/reference/cli/<command>`                   |
| "How do I use Mastra with this product?"           | `templates/integration.md`   | `/integrations/<category>/<product>`         |

1. Copy the template's skeleton into the new `.mdx` file and replace every `$PLACEHOLDER`.
2. Compare the result with the template's example page and with neighboring pages. Where the section has an established convention, follow it.
3. Remove optional sections the page doesn't need.
4. Before finishing, run `templates/CHECKLIST.md` and the template's own self-review checklist.

Templates set the starting shape, not a fixed form. Match the reader's task and the conventions of the current section.

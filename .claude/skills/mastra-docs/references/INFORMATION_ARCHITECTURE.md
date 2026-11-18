# Documentation information architecture

Use this file to choose the canonical home for content before writing it.

## Content families

| Surface         | Source                             | Purpose                                                                    |
| --------------- | ---------------------------------- | -------------------------------------------------------------------------- |
| `/docs`         | `docs/src/content/en/docs`         | Mastra concepts, capabilities, setup, decisions, and focused usage         |
| `/integrations` | `docs/src/content/en/integrations` | External products, providers, frameworks, channels, and deployment targets |
| `/reference`    | `docs/src/content/en/reference`    | API, configuration, CLI, types, and lookup material                        |
| `/models`       | `docs/src/content/en/models`       | Generated model and provider information; do not edit manually             |

Route tooling may understand older families so redirects can be maintained. That compatibility does not make an old route family the right destination for new pages.

## Choose the page owner

Use `/docs` when Mastra owns the concept or the reader's decision. Examples include agents, workflows, memory, storage, Studio, authentication, and deployment concepts.

Use `/integrations` when the page primarily explains how Mastra works with an external product or ecosystem. Examples include frameworks, databases, observability exporters, channels, browser providers, authentication providers, and deployment platforms.

Use `/reference` when readers need exact signatures, options, return values, events, commands, or type details. Link to a docs page for conceptual explanation instead of repeating it.

Page structure does not determine its content family. A task-oriented page can live under `/docs` or `/integrations`; its location depends on ownership.

## Canonical ownership

Before adding a page:

1. Search all content families for the concept and its former names.
2. Identify the page that should remain canonical after the change.
3. Add missing information to that page when the audience and intent match.
4. Consolidate or redirect overlapping pages instead of leaving parallel explanations.
5. Link to reference material for exhaustive API details.

Do not create a second page merely because a sidebar has another plausible category. One page can be linked from several places.

## Admission to Guides

Treat the Guides section within `/docs` as curated, not the default home for task-oriented documentation. New pages belong in the relevant product section unless there's a clear reason otherwise.

Before adding a Guide:

1. Identify the reader's problem and the outcome the page delivers.
2. Explain what it contributes beyond the canonical feature documentation. A Guide should walk through an applied scenario or develop a coherent explanation of a broader problem, not simply introduce a feature and list its capabilities.
3. Check whether the material fits better in an existing product page or a focused page alongside it. Code examples, numbered steps, and a "When to use" section don't by themselves justify placement in Guides.
4. Propose the placement and get the user's approval before adding the page to Guides. Include the best alternative location and why Guides is preferable. An AI review doesn't replace this approval.

Feature maturity labels belong with the feature documentation, not on the Guide's navigation entry. Mention relevant beta limitations within the Guide.

## Sidebars and navigation

- `docs/src/content/en/docs/sidebars.js` owns the main docs navigation and contextual categories.
- `docs/src/content/en/integrations/sidebars.js` owns integration categories, labels, ordering, links, and icon metadata.
- `docs/src/content/en/reference/sidebars.js` owns reference navigation and sorting expectations.
- Separate sidebar exports, such as the platform sidebar, may represent a distinct navigation surface without creating a new route family.
- Labels marked with `sidebar-group-name` are structural navigation labels. Do not derive URLs or content ownership from them.
- Files whose names start with `_` are partials or support files, not public route candidates.

## Route naming

- Use lowercase, descriptive route segments.
- Prefer stable product concepts over temporary feature labels or sidebar group names.
- Use `overview.mdx` for a category landing page when sibling pages share its namespace.
- Keep one canonical route for a topic and redirect historical routes to it.
- Avoid chained destinations. A redirect destination must be the final canonical page.
- Preserve useful section anchors when consolidating a focused page into a larger page.

Routes, components, frontmatter, and page structure may affect generated llms-txt and embedded documentation outputs.

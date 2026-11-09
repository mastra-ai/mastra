# Overview page template

Guide: `references/DOC.md` (Overview pages).

## Purpose

Answers: "What is this area of Mastra, what are my options, and where do I start?"

Use it for a category landing page under `/docs`, such as agents, memory, auth, deployment, or storage.

Don't use it for:

- a single capability or behavior (use `concept.md`);
- enabling one feature (use `setup.md`);
- an exhaustive list of child pages, which the sidebar already provides;
- an external product (use `integration.md`).

## Title grammar

- `title` is the category name alone when it is clear and established, such as `Memory`, `Auth`, or `Storage`.
- The H1 matches the category name.
- Don't add `Overview`, `Introduction`, or a `| $CATEGORY` suffix only to satisfy a formula.

## Frontmatter

```yaml
---
title: '$CATEGORY'
description: 'What the category covers and the main choice it helps readers make.'
packages:
  - '@mastra/core'
---
```

## Skeleton

```mdx
---
title: '$CATEGORY'
description: 'What the category covers and the main choice it helps readers make.'
packages:
  - '@mastra/core'
---

import { CardGrid, CardGridItem } from '@site/src/components/cards/card-grid';

# $CATEGORY

State what the category does, what it includes and excludes, and the main decision this page helps readers make.

## When to use $CATEGORY

Describe the situations where readers need this category. Remove this section if the choice is obvious.

## Choose an approach

Explain the main options with a table, list, `CardGrid`, or `IntegrationGrid`.

| Option    | Use it when                   |
| --------- | ----------------------------- |
| $OPTION_A | The situation that favors it. |
| $OPTION_B | The situation that favors it. |

<CardGrid columns={2}>
  <CardGridItem
    title="$OPTION_A"
    description="One sentence on what this page covers."
    href="/docs/$CATEGORY/$OPTION_A"
  />
  <CardGridItem
    title="$OPTION_B"
    description="One sentence on what this page covers."
    href="/docs/$CATEGORY/$OPTION_B"
  />
</CardGrid>

## Quickstart

Include this only when a short working example clarifies the category. Follow `quickstart.md`.

## $CATEGORY_WIDE_TOPIC

Add short sections for constraints, prerequisites, or behavior shared across the category.

## Next steps

- [$FOCUSED_PAGE](/docs/$CATEGORY/$FOCUSED_PAGE)
- [$REFERENCE_PAGE](/reference/$CATEGORY/$REFERENCE_PAGE)
```

Use `IntegrationGrid` instead of `CardGrid` when the choices are integrations listed in `docs/src/content/en/integrations/sidebars.js`.

## Self-review checklist

Run `CHECKLIST.md`, then:

- [ ] Does the opening say what the category includes and excludes?
- [ ] Can a reader pick a starting point from the page without opening every child page?
- [ ] Does each choice link to a focused page or reference that owns the detail?
- [ ] Is the page free of material copied from child pages beyond a one-sentence summary?
- [ ] If a quickstart is present, does it reach a verifiable result in a few steps?

## Example

`docs/src/content/en/docs/auth/overview.mdx`

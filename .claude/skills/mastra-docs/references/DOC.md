# DOC styleguide

Read STYLEGUIDE.md first.

Use this file for general docs pages. There are two page types.

## Overview pages

Use for category landing pages like agents/overview.mdx or memory/overview.mdx.

What to do:

- introduce the category
- list the main sub-topics
- link to the standard pages in the category
- help the reader decide where to start
- keep it broad, not deep

Use this shape:

```mdx
---
title: '$CATEGORY overview'
description: 'One to two sentences describing what this topic covers.'
packages:
  - '@mastra/core'
  - '@mastra/<module>'
---

# $CATEGORY overview

One to two sentence intro. Say what the category does and why it matters.

Optional image or diagram.

- [Sub-topic A](/docs/$CATEGORY/sub-topic-a): one sentence on what it does
- [Sub-topic B](/docs/$CATEGORY/sub-topic-b): one sentence on what it does

## When to use $CATEGORY

Short paragraph or short list of use cases.

## Get started

Point to the best starting page.

## Optional sections

Add short H2 sections only for category-wide topics like storage, debugging, or shared config.

## Next steps

- [Sub-topic A](/docs/$CATEGORY/sub-topic-a)
- [Sub-topic B](/docs/$CATEGORY/sub-topic-b)
- [API reference](/reference/$CATEGORY/$CLASS)
```

Rules:

- title must be $CATEGORY overview
- opening paragraph must be one or two sentences
- every standard page in the category should be linked from the page
- if one sub-topic needs more than two paragraphs, move it to its own standard page
- end with Next steps, not Related

## Standard pages

Use for every non-overview page in the category.

What to do:

- teach one concept
- give enough context to use it
- show working code
- link to the API reference

Use this shape:

````mdx
---
title: '$FEATURE | $CATEGORY'
description: 'One sentence describing what the reader will learn.'
packages:
  - '@mastra/core'
  - '@mastra/<module>'
---

# $FEATURE

One to two sentence intro. Say what the feature is and why to use it.

## When to use $FEATURE

Include this when the reader may need help choosing this feature.

## Quickstart

Show the shortest working example.

```typescript title="src/mastra/<path>.ts"
import { Thing } from '@mastra/core/<module>';

const thing = new Thing({
  id: 'my-thing',
  // minimal config
});
```

## Core sections

Use one or more H2 sections. Each section should have:

1. one or two short paragraphs
2. a TypeScript example
3. a note linking to the API reference when needed

```typescript title="src/mastra/<path>.ts"
// Code showing this concept
```

:::note
Visit [ClassName reference](/reference/$CATEGORY/<class>) for the full config.
:::

## Related

- [Related page 1](/docs/$CATEGORY/page-1)
- [Related page 2](/docs/$CATEGORY/page-2)
- [API reference](/reference/$CATEGORY/<class>)
````

Rules:

- title must be $FEATURE | $CATEGORY
- opening paragraph must be one or two sentences
- quickstart should be the shortest copy-pasteable working example
- use line highlighting when it helps point out important lines
- use TypeScript fenced code blocks with a title for file paths
- use npm2yarn on bash install blocks
- use Tabs only for mutually exclusive choices
- use Steps and StepItem when order matters
- use note for API reference links
- use tip and warning sparingly
- end with Related
- keep one concept per page; split the page if it grows past three H2 subsections

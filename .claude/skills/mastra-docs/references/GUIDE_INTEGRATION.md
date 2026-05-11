# Integration guide styleguide

Read STYLEGUIDE.md first.

Use this file for integration guides.

Goal:

- document how to use Mastra with one external library or ecosystem
- organize by feature area, not by step order
- make each section self-contained so the reader can jump to it

Use this shape:

````mdx
---
title: 'Using $LIBRARY | $CATEGORY'
description: 'Learn how Mastra integrates with $LIBRARY and how to use it in your project'
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Using $LIBRARY

One or two sentences on what the library is and what the guide covers. Link to the official docs.

:::note
Link to migration guides or version notes when needed.
:::

:::tip
Link to live examples or related quickstarts.
:::

## Getting started

Briefly explain what the integration package provides and which features it enables. List the key hooks, functions, or APIs it connects to, with links to official docs.

Install the required packages:

```bash npm2yarn
npm install @mastra/package@latest other-package
```

One sentence confirming the reader is ready to continue.

## $FEATURE_AREA_1

Brief explanation of the feature area. Add a short list linking to the approaches below.

- [$APPROACH_A](#approach-a)
- [$APPROACH_B](#approach-b)

### $APPROACH_A

Context sentence.

<Tabs>
  <TabItem value="option-1" label="Option 1">

Brief explanation of this option.

```typescript title="src/path/to/file.ts"
// Complete code for option 1
```

  </TabItem>
  <TabItem value="option-2" label="Option 2">

Brief explanation of this option.

```typescript title="src/path/to/file.ts"
// Complete code for option 2
```

  </TabItem>
</Tabs>

### $APPROACH_B

Context sentence.

<Tabs>
  <TabItem value="option-1" label="Option 1">

Code and explanation for option 1.

  </TabItem>
  <TabItem value="option-2" label="Option 2">

Code and explanation for option 2.

  </TabItem>
</Tabs>

### $FRONTEND_HOOK

After the backend setup, show how to connect the frontend. Include a complete code example and highlight the key line.

```typescript {3}
// Frontend code connecting to the backend
```

## $FEATURE_AREA_2

Brief explanation of this feature area and when to use it.

### $CONCEPT_REFERENCE

Use a table or list for types, events, or data structures the reader needs to look up.

| Type     | Source      | Description        |
| -------- | ----------- | ------------------ |
| `type-a` | Component A | What it represents |
| `type-b` | Component B | What it represents |

### $PATTERN_1

Context for the pattern.

<Tabs>
  <TabItem value="backend" label="Backend">

```typescript title="src/path/to/backend.ts"
// Backend code
```

  </TabItem>
  <TabItem value="frontend" label="Frontend">

```typescript title="src/components/component.tsx"
// Frontend code
```

  </TabItem>
</Tabs>

:::tip
Explain naming conventions, key points, or common gotchas.
:::

### $PATTERN_2

Same structure as above.

For more details, see [Related doc](/docs/category/page).

## Recipes

### $RECIPE_1

Brief description. Link to reference docs or utilities.

### $RECIPE_2

Context sentence.

<Tabs>
  <TabItem value="backend" label="Backend">

```typescript title="src/path/to/file.ts"
// Backend code
```

  </TabItem>
  <TabItem value="frontend" label="Frontend">

```typescript title="src/components/component.tsx"
// Frontend code
```

  </TabItem>
</Tabs>

Key points:

- Point 1
- Point 2

For a complete implementation, see the [example-name example](https://link-to-example).
````

Rules:

- frontmatter title must be `Using $LIBRARY | $CATEGORY`
- H1 must be `Using $LIBRARY`
- after the intro, use `note` for migration or version notes and `tip` for live examples or related quickstarts when needed
- Getting started must install the integration package, explain what it provides, and list the main APIs it connects to
- keep Getting started short; this is not a tutorial
- H2 sections must be feature areas, not sequential steps
- each H3 must be a self-contained approach or pattern
- when a pattern has both server and client code, use `Tabs` with `Backend` and `Frontend`
- when there are multiple backend approaches, use `Tabs` with clear labels like `Mastra Server` or `Next.js`
- show complete working code in tabs
- use tables for types, events, and data structures in the relevant feature area
- put standalone patterns at the end under `Recipes`
- each recipe should include brief context, code, key points, and a link to a complete implementation when applicable
- after complex examples, add a `Key points:` list with one-sentence bullets
- link to live example repositories instead of duplicating entire apps
- do not add `Next steps` or `Related`
- use `npm2yarn` on install commands

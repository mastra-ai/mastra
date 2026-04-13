# Styleguide: Integration guide

An integration guide is a comprehensive reference for using Mastra with a specific external library or ecosystem (e.g. AI SDK UI). Unlike tutorials (which build one thing step-by-step), integration guides are organized by feature area. The reader jumps to the section they need — each section is self-contained.

Also read and follow the general [STYLEGUIDE.md](./STYLEGUIDE.md) for tone, readability, and formatting rules that apply to all documentation.

## Template

````mdx
---
title: 'Using $LIBRARY | $CATEGORY'
description: 'Learn how Mastra integrates with $LIBRARY and how to use it in your project'
---

import Tabs from '@theme/Tabs'
import TabItem from '@theme/TabItem'

# Using $LIBRARY

One to two sentences explaining what the library is and what you'll learn. Link to the library's official docs.

:::note
Link to migration guides or important version notes if applicable.
:::

:::tip
Link to live examples or related quickstart guides.
:::

## Getting started

Brief explanation of what the integration package provides and which features it enables. List the key hooks, functions, or APIs it integrates with, linking to their official docs.

Install the required packages:

```bash npm2yarn
npm install @mastra/package@latest other-package
```

One sentence confirming the reader is ready to proceed.

## $FEATURE_AREA_1

Brief explanation of the approaches available, with a bulleted list linking to the subsections below.

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

Once the backend is set up, show how to connect the frontend. Include a complete code example with the key line highlighted.

```typescript {3}
// Frontend code connecting to the backend
```

## $FEATURE_AREA_2

Brief explanation of the feature area and when to use it.

### $CONCEPT_REFERENCE (if applicable)

Reference table or list documenting the key types, events, or data structures.

| Type     | Source      | Description        |
| -------- | ----------- | ------------------ |
| `type-a` | Component A | What it represents |
| `type-b` | Component B | What it represents |

### $PATTERN_1

Context sentence explaining the pattern.

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

Same structure as above — context, then Backend/Frontend Tabs.

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

## Rules

1. **Title format**: Use `"Using $LIBRARY | $CATEGORY"` in frontmatter (e.g. `"Using AI SDK UI | Frameworks"`). The H1 matches: "Using $LIBRARY".
2. **Intro with admonitions**: After the intro paragraph, use `:::note` for migration guides or version notes, and `:::tip` for links to live examples or related quickstarts.
3. **"Getting started" section**: Install the integration package, briefly explain what it provides, and list the key APIs it connects to. Keep it short — this is not a tutorial.
4. **H2s are feature areas, not steps**: Organize by what the reader wants to do (Integration Guides, Custom UI, Recipes), not by sequential order. The reader should be able to jump to any H2 independently.
5. **H3s are self-contained patterns**: Each H3 within a feature area covers one approach or pattern. It should work on its own without reading the sections before it.
6. **Backend/Frontend Tabs**: When a pattern involves both server and client code, always use `<Tabs>` with `"Backend"` and `"Frontend"` tab labels. Show complete, working code in each tab.
7. **Approach Tabs**: When multiple backend approaches exist (e.g. Mastra server vs framework), use `<Tabs>` with descriptive labels (e.g. `"Mastra Server"`, `"Next.js"`).
8. **Reference tables**: Use tables for documenting types, events, or data structures that the reader needs to look up. Place them in the relevant feature area, not in a separate reference section.
9. **"Recipes" section**: Collect standalone patterns at the end under a "Recipes" H2. Each recipe is an H3 — brief context, code (often in Backend/Frontend Tabs), key points as bullets, and a link to a complete implementation.
10. **Key points pattern**: After complex code examples, list the important takeaways as bullets starting with "Key points:". Keep each point to one sentence.
11. **Link to live examples**: Reference external example repositories (e.g. UI Dojo) for complete implementations. Don't duplicate entire example apps in the guide.
12. **No "Next steps" or "Related" section**: Integration guides don't need a closing section — the Recipes section serves as the natural end.
13. **Use `npm2yarn` on install commands**: Same as other guide types.

## Example: AI SDK UI integration

See [ai-sdk-ui.mdx](../src/content/en/guides/build-your-ui/ai-sdk-ui.mdx) for the gold-standard implementation of this template.

Key structural elements from that guide:

```md
# Using AI SDK UI ← "Using $LIBRARY" H1

What the library is + what you'll learn
:::note migration guide :::
:::tip live examples :::

## Getting Started ← install + brief overview of integration points

## Integration Guides ← H2 feature area: backend setup

### Mastra's server ← approach A with Tabs (chatRoute/workflowRoute/networkRoute)

### Framework-agnostic ← approach B with Tabs (handleChatStream/handleWorkflowStream/...)

### useChat() ← frontend hook connecting to the routes

### useCompletion() ← another hook with Backend/Frontend Tabs

## Custom UI ← H2 feature area: rendering patterns

### Data part types ← reference table

### Rendering tool outputs ← Backend/Frontend Tabs

### Rendering workflow data ← Backend/Frontend Tabs

### Rendering network data ← Backend/Frontend Tabs

### Custom events ← Backend/Frontend Tabs

### Examples ← links to live implementations

## Recipes ← H2: standalone patterns

### Stream transformations ← brief + link

### Loading historical messages ← brief + link

### Passing additional data ← Backend/Frontend Tabs

### Workflow suspend/resume ← Backend/Frontend Tabs + key points

### Nested agent streams ← Backend/Frontend Tabs + key points

### Streaming from workflow steps ← Backend/Frontend Tabs + key points
```

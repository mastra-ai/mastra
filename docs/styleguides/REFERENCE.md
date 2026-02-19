# Styleguide: Reference page

This styleguide covers pages found in `docs/src/content/en/reference/`. A reference page is the complete API documentation for a class or function. The reader comes here to look up specific details, not to learn concepts — that's the job of the doc pages.

Also read and follow the general [STYLEGUIDE.md](./STYLEGUIDE.md) for tone, readability, and formatting rules that apply to all documentation.

## Template

````mdx
---
title: 'Reference: $NAME | $CATEGORY'
description: 'API reference for $NAME, $BRIEF_DESCRIPTION.'
packages:
  - '@mastra/core'
  - '@mastra/<module>'
---

# $NAME

**Added in:** `@mastra/$PACKAGE@$VERSION` (only if this is a new addition tied to a specific release)

One to two sentences explaining what the class or function does and when to use it.

Link to alternatives when they exist (e.g. "Use [`otherFunction()`](/reference/category/other) if you need $ALTERNATIVE.").

## Usage example

Brief sentence explaining the scenario.

```typescript title="src/mastra/index.ts"
import { $Name } from '@mastra/<package>'

// Minimal working example
```

If the API supports multiple calling patterns, show each one with a brief explanation between them.

## Constructor parameters / Parameters

<PropertiesTable
  content={[
    {
      name: '$PARAM',
      type: '$TYPE',
      description: 'What this parameter does.',
      isOptional: true,
      defaultValue: '$DEFAULT',
    },
  ]}
/>

## Properties (classes only)

<PropertiesTable
  content={[
    {
      name: '$PROPERTY',
      type: '$TYPE',
      description: 'What this property represents.',
    },
  ]}
/>

## Methods (classes only)

### $METHOD_CATEGORY (e.g. Lifecycle, Search, Utility)

#### `$methodName($PARAM, options?)`

One sentence describing what the method does.

```typescript
const result = await instance.$methodName('value', {
  option: true,
})
```

## $DOMAIN_SPECIFIC_SECTION (if applicable)

Additional sections for class-specific concerns (e.g. tool configuration, agent tools).
Use tables for listing capabilities, `<PropertiesTable>` for nested config options.

## Additional configuration (if applicable)

Advanced usage patterns that go beyond the basic parameters.
````

## Rules

1. **Title format**: Use `"Reference: $NAME | $CATEGORY"` in frontmatter. For functions, include parentheses in the name: `"Reference: chatRoute() | AI SDK"`. For classes, use the class name: `"Reference: Workspace Class | Workspace"`.
2. **H1 naming**: Functions include parentheses (`# chatRoute()`). Classes use the class name (`# Workspace Class`).
3. **"Added in:" badge**: Only include when the API was introduced in a specific release and the reader needs to know the minimum version. Place it immediately after the H1: `**Added in:** \`@mastra/$PACKAGE@$VERSION\``. Omit for APIs that have existed since the early versions.
4. **Link to alternatives**: When a similar API exists for a different context, link to it right after the description.
5. **Usage example first**: Show a minimal working example immediately after the description. If the API supports multiple calling patterns (e.g. static vs dynamic routing), show each one in the same section.
6. **`<PropertiesTable>` for all parameter/property tables**: Use the `<PropertiesTable>` component for constructor parameters, function parameters, and instance properties. Each entry needs `name`, `type`, `description`, and optionally `isOptional` and `defaultValue`.
7. **Group methods by category**: Use H3 headings for method categories (e.g. "Lifecycle", "Search operations") and H4 headings with backtick-wrapped names for individual methods: `` #### `methodName()` ``. Include parameter names in the heading to show the signature: `` #### `search(query, options?)` ``.
8. **One code example per method**: Every method must have at least one code example showing a real invocation.
9. **Return types**: Document non-obvious return types with `**Returns:** \`$Type\`` after the code example. Include an interface definition when the return type is a custom object.
10. **Domain-specific sections**: Add H2 sections for API-specific concerns (e.g. "Tool configuration", "Agent tools") after the standard sections. Use tables for listing capabilities.
11. **Link to doc pages**: When a concept needs more explanation than fits in a reference, link to the relevant doc page rather than duplicating content.

## Example: Workspace class

See [workspace-class.mdx](../src/content/en/reference/workspace/workspace-class.mdx) for the gold-standard class reference.

```md
# Workspace Class

**Added in:** `@mastra/core@1.1.0` ← new API, version matters

## Usage Example ← minimal working code

## Constructor parameters ← <PropertiesTable>

## Tool configuration ← domain-specific section

### Per-tool options ← nested <PropertiesTable>

## Properties ← <PropertiesTable>

## Methods

### Lifecycle ← H3 category

    #### `init()`                              ← H4 method + code
    #### `destroy()`

### Search operations

    #### `index(path, content, options?)`       ← signature in heading
    #### `search(query, options?)`

### Utility

    #### `getInfo()`
    #### `getPathContext()`
    #### `getToolsConfig()`

## Agent tools ← domain-specific: capability tables
```

## Example: chatRoute()

See [chat-route.mdx](../src/content/en/reference/ai-sdk/chat-route.mdx) for the gold-standard function reference.

```md
# chatRoute() ← parens in H1

What it does + link to alternative ← no version badge (not new)

## Usage example ← two calling patterns

## Parameters ← <PropertiesTable>

## Additional configuration ← advanced usage pattern
```

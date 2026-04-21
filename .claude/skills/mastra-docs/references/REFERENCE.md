# Reference page styleguide

Read STYLEGUIDE.md first.

Use this file for reference/API pages.

Goal:

- document one class or function completely
- optimize for lookup, not concept teaching
- link to doc pages when a concept needs explanation

Use this shape:

````mdx
---
title: 'Reference: $NAME | $CATEGORY'
description: 'API reference for $NAME, $BRIEF_DESCRIPTION.'
packages:
  - '@mastra/core'
  - '@mastra/<module>'
---

# $NAME

Added in: `@mastra/$PACKAGE@$VERSION`

One or two sentences on what the class or function does and when to use it.

Link to alternatives when they exist.

## Usage example

Brief sentence on the scenario.

```typescript title="src/mastra/index.ts"
import { $Name } from '@mastra/<package>';

// Minimal working example
```

If the API has multiple calling patterns, show each one here with a brief explanation.

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

## Properties

<PropertiesTable
  content={[
    {
      name: '$PROPERTY',
      type: '$TYPE',
      description: 'What this property represents.',
    },
  ]}
/>

## Methods

### $METHOD_CATEGORY

#### `$methodName($PARAM, options?)`

One sentence on what the method does.

```typescript
const result = await instance.$methodName('value', {
  option: true,
});
```

## $DOMAIN_SPECIFIC_SECTION

Add sections for API-specific concerns such as tool configuration or agent tools. Use tables for capability lists and `<PropertiesTable>` for nested config.

## Additional configuration

Add advanced usage patterns that go beyond the basic parameters.
````

Rules:

- frontmatter title must be `Reference: $NAME | $CATEGORY`
- for functions, include parentheses in `$NAME` in frontmatter and H1
- for classes, use the class name in frontmatter and H1
- include `Added in:` only when the API was introduced in a specific release and the minimum version matters
- place `Added in:` immediately after the H1
- omit `Added in:` for long-standing APIs
- link to alternative APIs right after the description when they exist
- put a minimal working usage example immediately after the description
- if the API has multiple calling patterns, show them in the Usage example section
- use `<PropertiesTable>` for constructor parameters, function parameters, and properties
- each `<PropertiesTable>` entry should include `name`, `type`, and `description`, and may include `isOptional`, `properties`, and `defaultValue`
- for nested types, use nested `properties` arrays
- check existing reference pages for `<PropertiesTable>` patterns and consistency
- group methods by category with H3 headings
- use H4 headings with backticked method signatures
- include parameter names in method headings
- every method must have at least one real code example
- add `Returns: $Type` after the code example when the return type is not obvious
- include an interface definition when the return type is a custom object
- add domain-specific H2 sections after the standard sections when needed
- use tables for capability lists
- link to doc pages instead of duplicating long conceptual explanations

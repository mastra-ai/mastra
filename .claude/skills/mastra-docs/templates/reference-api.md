# API reference page template

Guide: `references/REFERENCE.md`.

## Purpose

Answers: "What exactly does this API accept, return, and do?"

Use it for a class, factory, function, method, options object, or result type under `/reference`. A page may cover one primitive or a tightly related API surface that readers look up together.

Don't use it for:

- explaining when or why to use the API (use `concept.md` and link to it);
- step-by-step instructions (use `how-to.md`);
- CLI commands (use `reference-cli.md`);
- internal or unexported APIs. Document only public exports and supported contracts.

## Title grammar

- `title` follows `Reference: $NAME | $CATEGORY`, such as `Reference: Agent.getMemory() | Agents`.
- Include parentheses for functions and methods when that is the established pattern, such as `Memory.createThread()`.
- The H1 is the API name exactly as readers write it in code, such as `Agent.getMemory()` or `Workflow class`.

## Frontmatter

```yaml
---
title: 'Reference: $NAME | $CATEGORY'
description: 'API reference for $NAME, including its parameters, return value, and $BEHAVIOR.'
packages:
  - '@mastra/core'
---
```

## Skeleton

````mdx
---
title: 'Reference: $NAME | $CATEGORY'
description: 'API reference for $NAME, including its parameters, return value, and $BEHAVIOR.'
packages:
  - '@mastra/core'
---

# $NAME

Say what the API does and when readers use it. Link to an alternative API when choosing between them matters.

## Usage example

```typescript title="src/mastra/index.ts"
import { $NAME } from '@mastra/$PACKAGE';

// Minimal supported usage
```

## Parameters

<PropertiesTable
  content={[
    {
      name: '$PARAM',
      type: 'string',
      description: 'What the parameter controls.',
    },
    {
      name: 'options',
      type: '$OPTIONS_TYPE',
      description: 'Optional settings.',
      isOptional: true,
      properties: [
        {
          type: '$OPTIONS_TYPE',
          parameters: [
            {
              name: '$OPTION',
              type: 'number',
              description: 'What the option controls.',
              isOptional: true,
              defaultValue: '$DEFAULT',
            },
          ],
        },
      ],
    },
  ]}
/>

## Returns

<PropertiesTable
  content={[
    {
      name: '$RESULT',
      type: 'Promise<$RESULT_TYPE>',
      description: 'What the promise resolves to, and when it is undefined or throws.',
    },
  ]}
/>

## Methods

### `$METHOD(value, options?)`

Describe the purpose, return value, side effects, and failure behavior. Remove this section for a function page.

## Extended usage example

Show a non-obvious usage. Remove this section if the first example covers it.

## Related

- [$CONCEPT](/docs/$CATEGORY/$CONCEPT)
- [$RELATED_API](/reference/$CATEGORY/$RELATED_API)
````

`PropertiesTable` is available globally in MDX and needs no import.

## Self-review checklist

Run `CHECKLIST.md`, then:

- [ ] Does the H1 match the exported name exactly, including casing and parentheses?
- [ ] Is every parameter, option, and return field checked against the exported types?
- [ ] Does each `PropertiesTable` entry have `name`, `type`, and `description`, plus `isOptional` and `defaultValue` where source defines them?
- [ ] Are thrown errors, side effects, and persistence behavior stated where they apply?
- [ ] Does the page avoid task walkthroughs, linking to docs pages for them instead?
- [ ] Is each option documented in one place only?

## Example

`docs/src/content/en/reference/agents/getMemory.mdx`

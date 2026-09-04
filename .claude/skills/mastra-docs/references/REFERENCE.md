# Reference page styleguide

Use this file for API, configuration, CLI, type, and lookup pages under `docs/src/content/en/reference`.

## Goal

- Make exact behavior and configuration easy to find.
- Document the public contract completely enough for implementation work.
- Link to docs pages for conceptual explanation and task guidance.

## Reference page types

Choose the structure that matches the subject:

- class or factory;
- standalone function or method;
- options or configuration object;
- return value, event, stream, or result type;
- CLI command;
- package or subsystem overview;
- migration reference.

A reference page may document one primitive or a tightly related API surface. Do not split related information when readers need it together for lookup.

## Frontmatter and title

The common title pattern is `Reference: $NAME | $CATEGORY`.

```mdx
---
title: 'Reference: $NAME | $CATEGORY'
description: 'API reference for $NAME and its supported configuration.'
packages:
  - '@mastra/core'
---

# $NAME
```

For functions, include parentheses in the title when that is the established pattern. Use the class, command, type, or subsystem name directly in the H1.

Add `**Added in:**` immediately after the H1 only when the minimum package version matters. Omit it for long-standing APIs and new packages whose initial version is already implied.

## Opening and usage

Start with a short description of what the API does and when readers use it. Link to an alternative API when choosing between them matters.

Include a minimal usage example near the beginning when it helps readers orient themselves. A signature-only or lookup page may start with parameters, syntax, or command usage instead.

```typescript title="src/mastra/index.ts"
import { Name } from '@mastra/package';

// Minimal supported usage
```

Do not force an example that adds no information beyond the signature.

## Parameters, properties, and options

Use `PropertiesTable` for structured parameters, properties, and configuration. See `COMPONENTS.md` for its supported shape.

Each entry should include `name`, `type`, and `description`. Add optional, default, and nested fields when supported by source.

## Methods and functions

Use backticked signatures in headings:

```md
### `methodName(value, options?)`
```

For each method or function, document the information readers need:

- purpose;
- parameters not already covered by a shared table;
- return value;
- thrown errors or important failure behavior;
- side effects, lifecycle, or persistence behavior;
- an example when usage is not obvious.

Group methods when categories improve lookup. Use the heading depth that fits the page; do not add an empty category level.

State `Returns: $TYPE` when the return type is not evident. Document custom return objects with an interface, table, or linked type reference.

## CLI reference

For a CLI command, include:

- syntax;
- arguments and options;
- defaults;
- required build or initialization state;
- environment variables;
- important side effects;
- short examples for common invocations.

Keep task walkthroughs in `/docs` or `/integrations` and link to them.

## Events, streams, and result objects

Document:

- the object or event shape;
- discriminating fields;
- when each variant occurs;
- ordering or lifecycle guarantees;
- completion and error behavior;
- links to guides that show consumption patterns.

Use tables for capability matrices and stable enumerations. Use code blocks for exact object shapes.

## Ordering

A common order is usage, parameters, properties, methods, return values, and domain-specific details. Change the order when readers need domain context or a different lookup path first.

Large class references may interleave usage and domain-specific sections with formal tables. Keep headings predictable and avoid repeating the same option in several places.

## Reference-specific rules

- Document only public exports and supported contracts.
- Keep migration and compatibility notes close to the affected API.
- Update related reference pages when a shared type or behavior changes.

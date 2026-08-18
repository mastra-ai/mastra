# Docs page styleguide

Use this file for product documentation under `docs/src/content/en/docs`.

## Page types

Most docs pages fit one of these patterns:

- **Overview:** Defines a category, explains important choices, and routes readers to focused material.
- **Focused concept:** Explains one coherent capability, behavior, or mental model.
- **Setup or configuration:** Helps readers enable and configure a Mastra-owned feature.
- **Task-oriented:** Takes readers from a known starting point to a verifiable result.

These are authoring patterns, not mandatory templates. A page may combine them when the result remains coherent.

## Overview pages

Use an overview for a category landing page such as agents, memory, authentication, deployment, or storage.

An overview should:

- define what the category includes and excludes;
- explain the main choices or subtopics;
- help readers choose where to start;
- link to the most useful focused pages and reference material;
- include category-wide constraints or prerequisites;
- provide a short working path when immediate setup helps readers understand the category.

Useful structures include:

- a short list of capabilities;
- a decision table;
- `CardGrid` for curated destinations;
- `IntegrationGrid` for provider choices;
- a diagram or architecture explanation;
- a quickstart;
- short category-wide sections.

Do not turn the overview into a copy of every child page. It does not need to link every page if the sidebar or a focused index already provides exhaustive navigation.

### Suggested shape

```mdx
---
title: '$CATEGORY'
description: 'What the category helps readers understand or accomplish.'
packages:
  - '@mastra/core'
---

# $CATEGORY

State what the category does and the main decision the page helps readers make.

## Choose an approach

Explain the important options with a table, list, cards, or integration grid.

## Quickstart

Include this only when a short working example clarifies the category.

## Category-wide topic

Add sections for behavior shared across the category.

## Next steps

Add selected follow-up links when they improve navigation.
```

Use the category name for the title when it is clear and established. Do not add a suffix only to satisfy a formula.

## Focused concept pages

Use a focused page when readers need one coherent explanation or capability.

A focused page should:

- state what the concept is and why it matters;
- explain when to use it if readers face a real choice;
- show usage when code or configuration is part of the concept;
- cover relevant behavior, constraints, and tradeoffs;
- link to exact API reference pages for exhaustive options.

Keep related sections together even when the page has more than three H2 sections. Split it when sections have independent audiences, tasks, or canonical ownership.

### Suggested shape

````mdx
---
title: '$FEATURE | $CATEGORY'
description: 'What the reader will understand or accomplish.'
packages:
  - '@mastra/core'
---

# $FEATURE

Define the feature and its role in Mastra.

## When to use $FEATURE

Add this section only when readers need help choosing it.

## Configure $FEATURE

Introduce the example and show the supported setup.

```typescript title="src/mastra/<path>.ts"
// Complete code for the documented behavior
```

## Behavior or constraint

Explain the important runtime behavior, decision, or limitation.

## Related

Add selected links when they help readers continue.
````

The title commonly follows `$FEATURE | $CATEGORY`, but use the established title pattern for the section. The H1 should name the subject directly.

## Conceptual pages

Conceptual pages may compare patterns, explain architecture, or establish terminology without giving a quickstart.

- Organize around reader questions and decisions.
- Use examples to clarify a concept, not to force the page into a tutorial.
- State tradeoffs directly.
- Use tables when readers need to compare options.
- Link to implementation pages and references after explaining the model.

## Setup and configuration pages

- Start with the supported setup.
- Explain defaults and persistence boundaries when they affect behavior.
- Separate local development assumptions from production requirements.

## Task-oriented docs pages

Use a task-oriented page when the main purpose is to create, configure, run, or troubleshoot a Mastra-owned capability. Apply the task sequence in `STYLEGUIDE.md` and use only the sections the task needs.

### Quickstarts

A quickstart is a short task-oriented page or section focused on the fastest supported path to a working result.

- Prefer repository defaults over explaining every choice.
- State what generated commands or files create.
- Keep conceptual explanation brief and link to deeper docs.

# Tutorial guide styleguide

Read STYLEGUIDE.md first.

Use this file for tutorials.

Goal:

- teach the reader how to build one specific thing with Mastra
- go deeper than a quickstart
- assume the reader already has a Mastra project
- teach concepts while building toward a complete result

Use this shape:

````mdx
---
title: 'Guide: Building a $THING'
description: Build a $THING that $WHAT_IT_DOES.
---

# Building a $THING

In this guide, you'll build a $THING that $WHAT_IT_DOES. You'll learn how to $CONCEPT_1, $CONCEPT_2, and $CONCEPT_3.

## Prerequisites

- Node.js `v22.13.0` or later installed
- An API key from a supported [Model Provider](/models)
- An existing Mastra project. Follow the [installation guide](/guides/getting-started/quickstart) if needed.

## $STEP_1

Context on what this step does and why. Link to relevant reference docs.

```typescript title="src/mastra/index.ts"
import { Mastra } from '@mastra/core';
// highlight-next-line
import { NewThing } from '@mastra/core/new-thing';

// highlight-start
const thing = new NewThing({
  // configuration
});
// highlight-end

export const mastra = new Mastra({
  // highlight-next-line
  thing,
});
```

Explain what changed. If the reader must create files or folders manually, say so after the code block.

## $STEP_2

Context for the next concept.

Use the right language tag for non-TypeScript files:

```markdown title="path/to/file.md"
# Content of the file
```

If a step creates multiple files, show each file in its own code block and add a brief explanation between them.

## $STEP_3

Context.

When updating a file shown earlier, show the full file again and highlight the changed lines:

```typescript title="src/mastra/index.ts"
import { Mastra } from '@mastra/core';
import { NewThing } from '@mastra/core/new-thing';
// highlight-next-line
import { myAgent } from './agents/my-agent';

const thing = new NewThing({
  // configuration
});

export const mastra = new Mastra({
  thing,
  // highlight-next-line
  agents: { myAgent },
});
```

## Test the $THING

Start the dev server and test what you built:

```bash npm2yarn
npm run dev
```

Explain where to go and how to test.

Provide a sample input:

```text
Sample input to try
```

Describe the expected output. If responses are non-deterministic, say that output may vary, then show an example:

```md
Expected output format
```

## Next steps

You can extend this $THING to:

- Extension idea 1
- Extension idea 2
- Extension idea 3

Learn more:

- [Link to related concept](/docs/category/page)
- [Link to external resource](https://example.com)
````

Rules:

- frontmatter title must be `Guide: Building a $THING`
- H1 must be `Building a $THING`
- start the intro with `In this guide, you'll build...`
- include what the reader will learn in the intro
- use `Prerequisites`, not `Before you begin`
- always require an existing Mastra project and link to the quickstart
- each H2 step should teach a concept, not just list an action
- headings should name what is being created
- when a file changes across steps, show the full file again
- mark changed lines with `highlight-start`, `highlight-end`, and `highlight-next-line`
- a step may create multiple files; show each file in its own code block with a `title`
- use the correct language tag for non-TypeScript files
- always include `Test the $THING`
- show how to start the dev server, where to navigate, a sample input, and expected output
- note when outputs may vary
- end with Next steps
- Next steps should include extension ideas and a Learn more list
- do not add a congratulations section
- do not use the `<Steps>` component
- use `npm2yarn` on install commands

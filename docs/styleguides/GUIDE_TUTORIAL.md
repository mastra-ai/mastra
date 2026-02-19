# Styleguide: Tutorial guide

A guide tutorial teaches the reader how to build something specific with Mastra. Unlike quickstarts (which get to a working result as fast as possible), tutorials go deeper — each step teaches a concept while building toward a complete project. The reader already has a Mastra project set up.

Also read and follow the general [STYLEGUIDE.md](./STYLEGUIDE.md) for tone, readability, and formatting rules that apply to all documentation.

## Template

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
- An existing Mastra project (Follow the [installation guide](/guides/getting-started/quickstart) to set up a new project)

## $STEP_1

Context sentence explaining what this step does and why. Mention the classes or concepts involved, linking to their reference docs.

```typescript title="src/mastra/index.ts"
import { Mastra } from '@mastra/core'
// highlight-next-line
import { NewThing } from '@mastra/core/new-thing'

// highlight-start
const thing = new NewThing({
  // configuration
})
// highlight-end

export const mastra = new Mastra({
  // highlight-next-line
  thing,
})
```

Explain what the code did. If files or folders need to be created manually, state that clearly after the code block.

## $STEP_2

Context sentence explaining the next concept.

If this step creates non-TypeScript files, use the appropriate language tag:

```markdown title="path/to/file.md"
# Content of the file
```

If this step creates multiple files, show each one with its own code block and a brief explanation between them.

## $STEP_3

Context sentence.

When updating a file shown in a previous step, show the full file again with highlight comments marking the new lines:

```typescript title="src/mastra/index.ts"
import { Mastra } from '@mastra/core'
import { NewThing } from '@mastra/core/new-thing'
// highlight-next-line
import { myAgent } from './agents/my-agent'

const thing = new NewThing({
  // configuration
})

export const mastra = new Mastra({
  thing,
  // highlight-next-line
  agents: { myAgent },
})
```

## Test the $THING

Start the dev server and interact with what you built:

```bash npm2yarn
npm run dev
```

Explain how to access and test (e.g. open Studio, navigate to a specific page).

Provide a sample input the reader can use:

```text
Sample input to try
```

Describe the expected output. Since agent responses are non-deterministic, note that output may vary, then show an example:

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

## Rules

1. **Title format**: Use `"Guide: Building a $THING"` in frontmatter. The H1 drops the "Guide:" prefix and uses a gerund: "Building a $THING".
2. **Intro paragraph**: Start with "In this guide, you'll build..." followed by what the reader will learn. List the key concepts with links to reference docs.
3. **"Prerequisites" section**: Use "Prerequisites" (not "Before you begin"). Always require an existing Mastra project and link to the quickstart. Tutorials don't start from scratch.
4. **Each H2 teaches a concept**: Unlike quickstarts where steps are actions (install, create, configure), tutorial steps introduce concepts (workspace, skill, agent). The heading should name what's being created (e.g. "Create the workspace", "Create the code standards skill").
5. **Show files evolving**: When a file is modified across multiple steps, show the full file each time with `// highlight-start`, `// highlight-end`, and `// highlight-next-line` comments marking the new or changed lines. This lets the reader see what changed without diffing.
6. **Multiple files per step**: Steps can create more than one file. Show each file in its own code block with a `title` attribute. Use the appropriate language tag for non-TypeScript files (markdown, json, etc.).
7. **"Test the $THING" section**: Always include a test step. Show how to start the dev server, where to navigate, a sample input to try, and the expected output. Note that agent responses are non-deterministic when applicable.
8. **Close with "Next steps"**: List extension ideas as bullets (what the reader could build next), then a "Learn more" section with links to related docs and external resources. No congratulations message.
9. **No `<Steps>` component**: Like quickstarts, tutorials use H2 headings as steps for better navigation and longer content per step.
10. **Use `npm2yarn` on install commands**: Same as other guide types.

## Example: Code review bot

See [code-review-bot.mdx](../src/content/en/guides/guide/code-review-bot.mdx) for the gold-standard implementation of this template.

Key structural elements from that guide:

```md
# Building a Code Review Bot ← gerund H1

In this guide, you'll build... you'll learn how to... ← intro with learning objectives

## Prerequisites ← existing Mastra project required

## Create the workspace ← step: concept + code + file creation

## Create the code standards skill ← step: multiple files (SKILL.md + reference)

## Create the review agent ← step: new file + update existing file with highlights

## Test the bot ← dev server + sample input + expected output

## Next steps ← extension ideas + learn more links
```

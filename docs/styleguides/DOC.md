# Styleguide: Normal documentation page

This styleguide covers the two page types found in `docs/src/content/en/docs/`: **Overview pages** and **standard pages**. Every category (agents, memory, workflows, etc.) has one overview page and one or more standard pages.

Also read and follow the general [STYLEGUIDE.md](./STYLEGUIDE.md) for tone, readability, and formatting rules that apply to all documentation.

## How to decide which template to use

- **Overview page**: the landing page for a category (e.g. `agents/overview.mdx`, `memory/overview.mdx`). It introduces the topic, lists the key concepts, and links to the standard pages in the same category.
- **Standard page**: every other page in the category. It teaches a single concept with code examples and configuration details.

## Overview page

### Purpose

An overview page orients the reader. It answers "what is this category about?" and "where do I go next?" It should not go deep into any single feature — that is the job of the standard pages it links to.

### Template

```mdx
---
title: '$TOPIC overview | $CATEGORY'
description: 'One to two sentences describing what this topic covers.'
packages:
  - '@mastra/core'
  - '@mastra/<module>'
---

# $TOPIC

One to two sentence introduction explaining the core concept. State what it enables and why it matters.

Optional image or diagram showing the concept at a high level.

Bulleted list of the key sub-topics in this category. Each item links to the corresponding standard page and includes a short (one sentence) description:

- [**Sub-topic A**](/docs/$CATEGORY/sub-topic-a): What sub-topic A does.
- [**Sub-topic B**](/docs/$CATEGORY/sub-topic-b): What sub-topic B does.

## When to use $TOPIC

Short paragraph or bulleted list of use cases. Help the reader decide if this category is relevant to them and what problems it can solve.

## Get started

Brief paragraph directing the reader to the right starting point. This can be a short list of links or a sentence pointing to the most common entry point.

## Optional additional overview sections

Add H2 sections for cross-cutting concerns that apply to the whole category (e.g. storage, debugging, common configuration). Keep them short and link to the standard page that covers the topic in depth.

## Next steps

- [Sub-topic A](/docs/$CATEGORY/sub-topic-a)
- [Sub-topic B](/docs/$CATEGORY/sub-topic-b)
- [API reference](/reference/$CATEGORY/$CLASS)
```

### Rules

1. **Title format**: Use `"$TOPIC overview | $CATEGORY"` (e.g. `"Memory overview | Memory"`). The part after the pipe is the sidebar category label.
2. **Opening paragraph**: One to two sentences only. Explain what the category is and what it enables.
3. **Sub-topic list**: Use bold linked names followed by a dash and a one-sentence description. Every standard page in the category should be reachable from this list.
4. **No deep dives**: Keep individual sections short. If you're writing more than two paragraphs about a single sub-topic, move that content to a standard page and link to it instead.
5. **Close with "Next steps"**: List links to the standard pages and the API reference. This replaces the "Related" section used on standard pages.

### Example: Memory overview

```mdx
---
title: 'Memory overview | Memory'
description: "Learn how Mastra's memory system works with working memory, message history, semantic recall, and observational memory."
packages:
  - '@mastra/core'
  - '@mastra/memory'
---

# Memory

Memory enables your agent to remember user messages, agent replies, and tool results across interactions, giving it the context it needs to stay consistent and produce better answers over time.

Mastra supports four complementary memory types:

- [**Message history**](/docs/memory/message-history): Keeps recent messages from the current conversation.
- [**Working memory**](/docs/memory/working-memory): Stores persistent, structured user data such as names and preferences.
- [**Semantic recall**](/docs/memory/semantic-recall): Retrieves relevant messages from older conversations based on semantic meaning.
- [**Observational memory**](/docs/memory/observational-memory): Uses background agents to maintain a dense observation log.

## When to use memory

Use memory when your agent needs to remember user messages, agent replies, and tool results across interactions, giving it the context it needs to stay consistent, maintain conversation flow, and produce better answers over time.

## Get started

Choose a memory option to get started:

- [Message history](/docs/memory/message-history)
- [Working memory](/docs/memory/working-memory)

## Storage

Before enabling memory, configure a storage adapter. Mastra supports PostgreSQL, MongoDB, libSQL, and [more](/docs/memory/storage#supported-providers).

See [Storage](/docs/memory/storage) for configuration options and examples.

## Next steps

- [Message history](/docs/memory/message-history)
- [Working memory](/docs/memory/working-memory)
- [Memory configuration reference](/reference/memory/memory-class)
```

## Standard page

### Purpose

A standard page teaches one concept. It gives the reader enough context to understand the feature, shows working code, and links to the API reference for full details.

### Template

````mdx
---
title: '$FEATURE | $CATEGORY'
description: 'One sentence describing what the reader will learn.'
packages:
  - '@mastra/core'
  - '@mastra/<module>'
---

import Tabs from '@theme/Tabs'
import TabItem from '@theme/TabItem'

# $FEATURE

One to two sentence introduction explaining what this feature is and why you would use it.

## When to use $FEATURE

Short paragraph or bulleted list of use cases. Help the reader decide whether this page is relevant to them.

## Quick start

Minimal working code example showing the feature in action. Include only the essentials — imports, setup, and basic usage.

```typescript title="src/mastra/<path>.ts"
import { Thing } from '@mastra/core/<module>'

const thing = new Thing({
  id: 'my-thing',
  // minimal config
})
```

## Core concept sections

One or more H2 sections, each covering a distinct aspect of the feature. Each section should have:

1. A short explanation (one to two paragraphs).
2. A code example demonstrating the concept.
3. An :::note block linking to the API reference when relevant.

```typescript title="src/mastra/<path>.ts"
// Code showing this concept
```

:::note

Visit [ClassName reference](/reference/$CATEGORY/<class>) for a full list of configuration options.

:::

## Alternative approaches (if applicable)

Use Tabs when the reader can choose between multiple approaches.

<Tabs>
  <TabItem value="approach-a" label="Approach A">
    Explanation and code for approach A.
  </TabItem>
  <TabItem value="approach-b" label="Approach B">
    Explanation and code for approach B.
  </TabItem>
</Tabs>

## Related

- [Related page 1](/docs/$CATEGORY/page-1)
- [Related page 2](/docs/$CATEGORY/page-2)
- [API reference](/reference/$CATEGORY/<class>)
````

### Rules

1. **Title format**: Use `"$FEATURE | $CATEGORY"` (e.g. `"Working memory | Memory"`).
2. **Opening paragraph**: One to two sentences. State what the feature **is** and what it **does**.
3. **"When to use" section**: Include this when the feature has clear alternatives or when the reader may be unsure if it's the right choice.
4. **Quick start**: Show the shortest working example. The reader should be able to copy this block and have something functional. Use line highlighting (`{2,5-7}`) to draw attention to the relevant lines.
5. **Code examples**: Always include TypeScript code in a fenced block with syntax highlighting. Add a `title` attribute for file paths. Use the `npm2yarn` flag on `bash` blocks for install commands.
6. **Tabs**: Use `<Tabs>` when the reader must choose between mutually exclusive approaches (e.g. Zod vs JSON Schema, generate vs stream, different providers).
7. **Steps**: Use `<Steps>` and `<StepItem>` for setup/installation sequences where order matters.
8. **Admonitions**: Use `:::note` to link to API reference pages. Use `:::tip` and `:::warning` sparingly for supplementary information.
9. **Close with "Related"**: Always end with a "Related" section that links to related pages and the API reference.
10. **One concept per page**: If a section grows beyond three H2-level subsections, consider splitting it into its own page.

### Example: Standard page

````mdx
---
title: 'Structured output | Agents'
description: 'Learn how to generate structured data from agents using schemas.'
packages:
  - '@mastra/core'
---

import Tabs from '@theme/Tabs'
import TabItem from '@theme/TabItem'

# Structured output

Structured output lets an agent return an object that matches the shape defined by a schema instead of returning text.

## When to use structured output

Use structured output when you need an agent to return a data object rather than text. This is useful for API calls, UI rendering, or application logic that depends on well-defined fields.

## Defining schemas

<Tabs>
  <TabItem value="zod" label="Zod">

Define the output shape using Zod:

```typescript
import { z } from 'zod'

const response = await testAgent.generate('Help me plan my day.', {
  structuredOutput: {
    schema: z.array(
      z.object({
        name: z.string(),
        activities: z.array(z.string()),
      }),
    ),
  },
})

console.log(response.object)
```

  </TabItem>
  <TabItem value="json-schema" label="JSON Schema">

Use JSON Schema to define the output structure:

```typescript
const response = await testAgent.generate('Help me plan my day.', {
  structuredOutput: {
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          activities: { type: 'array', items: { type: 'string' } },
        },
        required: ['name', 'activities'],
      },
    },
  },
})

console.log(response.object)
```

  </TabItem>
</Tabs>

:::note

Visit [.generate()](/reference/agents/generate) for a full list of configuration options.

:::

## Related

- [Using tools](/docs/agents/using-tools)
- [Agent memory](/docs/agents/agent-memory)
````

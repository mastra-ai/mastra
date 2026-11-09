# Concept page template

Guide: `references/DOC.md` (Focused concept pages and Conceptual pages).

## Purpose

Answers: "What is this capability, how does it behave, and when should I use it?"

Use it for one coherent capability, behavior, or mental model under `/docs`, such as structured output, working memory, or suspend and resume. It may include configuration when code is part of the concept.

Don't use it for:

- a category landing page (use `overview.md`);
- a sequence of steps that ends in a verifiable result (use `how-to.md`);
- a complete list of options or method signatures (use `reference-api.md` and link to it);
- an external product (use `integration.md`).

## Title grammar

- `title` follows `$FEATURE | $CATEGORY`, such as `Structured output | Agents`. Use the established pattern of the section when it differs.
- The H1 names the subject directly as a noun phrase, such as `Structured output`.
- Use sentence case.

## Frontmatter

```yaml
---
title: '$FEATURE | $CATEGORY'
description: 'What the reader will understand or accomplish with $FEATURE.'
packages:
  - '@mastra/core'
---
```

## Skeleton

````mdx
---
title: '$FEATURE | $CATEGORY'
description: 'What the reader will understand or accomplish with $FEATURE.'
packages:
  - '@mastra/core'
---

# $FEATURE

Define the feature and its role in Mastra in one or two sentences.

## When to use $FEATURE

Add this section only when readers face a real choice. Name the alternative and link to it.

## Configure $FEATURE

Introduce the example, then show the supported setup.

```typescript title="src/mastra/agents/$AGENT.ts"
import { Agent } from '@mastra/core/agent';

export const agent = new Agent({
  id: '$AGENT',
  name: '$AGENT_NAME',
  instructions: '$INSTRUCTIONS',
  model: '__GATEWAY_OPENAI_MODEL__',
});
```

Explain what the code does and what readers see when they run it.

## $BEHAVIOR_OR_CONSTRAINT

Explain the runtime behavior, tradeoff, or limitation that readers need to use the feature correctly. Use a table when readers compare options.

:::warning
Use a warning only for a likely failure mode or a security concern.
:::

## Related

- [$FEATURE reference](/reference/$CATEGORY/$FEATURE)
- [$RELATED_CONCEPT](/docs/$CATEGORY/$RELATED_CONCEPT)
````

Use `Tabs` from `@theme/Tabs` and `@theme/TabItem` only for mutually exclusive alternatives, such as Zod and JSON Schema versions of the same example.

## Self-review checklist

Run `CHECKLIST.md`, then:

- [ ] Does the first paragraph define the feature before showing usage or mechanics?
- [ ] Does the page cover one capability, with no section that has a separate audience or task?
- [ ] Is every behavior or tradeoff stated directly, without hedging?
- [ ] Does the page link to the reference page for exhaustive options instead of repeating them?
- [ ] Do code examples show the documented behavior completely enough to copy?

## Example

`docs/src/content/en/docs/agents/structured-output.mdx`

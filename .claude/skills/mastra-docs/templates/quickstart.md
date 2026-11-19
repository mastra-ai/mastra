# Quickstart template

Guide: `references/DOC.md` (Quickstarts).

## Purpose

Answers: "What's the fastest supported way to see this working?"

Use it for the shortest path from a known starting point to a first working result. A quickstart is usually a `## Quickstart` section inside an overview or setup page. Make it a separate page only when the path is long enough to need its own route and the parent page links to it.

Don't use it for:

- a task with choices, variations, or production concerns (use `how-to.md`);
- explaining every option or default (link to `reference-api.md` pages instead);
- connecting an external product (use `integration.md`).

## Title grammar

- As a section, the heading is `## Quickstart`.
- As a page, `title` follows `Quickstart | $CATEGORY` or the established pattern of the section, and the H1 is `Quickstart` or an imperative verb phrase naming the result, such as `Build your first agent`.

## Frontmatter

A section uses the parent page's frontmatter. A standalone page uses:

```yaml
---
title: 'Quickstart | $CATEGORY'
description: 'Get a working $FEATURE in a few steps, from installation to a verified result.'
packages:
  - '@mastra/core'
---
```

## Skeleton

````mdx
import Steps from '@site/src/components/Steps';
import StepItem from '@site/src/components/StepItem';

## Quickstart

State the result in one sentence and the starting point, such as an existing Mastra project.

<Steps>
  <StepItem>
    Install the package.

    ```bash npm2yarn
    npm install @mastra/$PACKAGE@latest
    ```

  </StepItem>

  <StepItem>
    Add the smallest working configuration. Use repository defaults instead of explaining every choice.

    ```typescript title="src/mastra/index.ts"
    import { Mastra } from '@mastra/core'
    import { $CLASS } from '@mastra/$PACKAGE'

    export const mastra = new Mastra({
      $OPTION: new $CLASS({ id: '$ID' }),
    })
    ```

    Visit the [`$CLASS` reference](/reference/$CATEGORY/$CLASS) for all options.

  </StepItem>

  <StepItem>
    Run it and say what readers should see, such as a command's output or a Studio view.

    ```bash npm2yarn
    npm run dev
    ```

  </StepItem>
</Steps>
````

Place the imports at the top of the page, after the frontmatter, not inside the section.

## Self-review checklist

Run `CHECKLIST.md`, then:

- [ ] Does the quickstart reach a working result in about five steps or fewer?
- [ ] Does it use defaults and skip optional choices?
- [ ] Does it state what each generated command or file creates?
- [ ] Is conceptual explanation limited to a sentence per step, with links to deeper docs?
- [ ] Does the last step say what readers see when it works?
- [ ] Can a reader copy each code block without filling in values the page didn't give them?

## Example

The `## Quickstart` section of `docs/src/content/en/docs/memory/overview.mdx`.

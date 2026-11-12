# How-to page template

Guides: `references/DOC.md` (Task-oriented docs pages) and `references/STYLEGUIDE.md` (Task-oriented instructions).

## Purpose

Answers: "How do I accomplish this specific task with Mastra?"

Use it when the main purpose is to create, configure, run, or troubleshoot a Mastra-owned capability, starting from a known point and ending with a result readers can verify. It can be a full page or a section of a larger page.

Don't use it for:

- the fastest path to a first working result (use `quickstart.md`);
- explaining how a feature behaves (use `concept.md`);
- a task that centers on an external product (use `integration.md`);
- the Guides section. Guides are curated; follow "Admission to Guides" in `references/INFORMATION_ARCHITECTURE.md` and get approval before placing a page there.

## Title grammar

- The H1 names the task with an imperative verb, such as `Deploy to Mastra platform` or `Build an eval loop`.
- `title` keeps the section's `| $CATEGORY` suffix where neighboring pages use one. Many sections shorten it to the task's noun, such as `Deploy | Mastra platform`; match the neighbors.
- Don't use `How to` or a gerund, such as `Deploying`, in the H1.

## Frontmatter

```yaml
---
title: '$TASK | $CATEGORY'
description: '$VERB $OBJECT with $FEATURE, including $NOTABLE_STEPS.'
packages:
  - '@mastra/core'
---
```

## Skeleton

````mdx
---
title: '$TASK | $CATEGORY'
description: '$VERB $OBJECT with $FEATURE, including $NOTABLE_STEPS.'
packages:
  - '@mastra/core'
---

import Steps from '@site/src/components/Steps';
import StepItem from '@site/src/components/StepItem';

# $VERB $OBJECT

State the result readers will have at the end of the page.

## Before you begin

List only what the first action needs, such as an existing Mastra project, credentials, or a minimum Node.js version.

## $VERB $OBJECT

<Steps>
  <StepItem>
    Describe the first action and why it's needed.

    ```bash npm2yarn
    npm install @mastra/$PACKAGE@latest
    ```

  </StepItem>

  <StepItem>
    Describe the next action. Show the code and say where it goes.

    ```typescript title="src/mastra/index.ts"
    // Code for this step
    ```

  </StepItem>

  <StepItem>
    Verify the result. Give the command, URL, or Studio action, and the expected output.

    ```bash
    $VERIFY_COMMAND
    ```

  </StepItem>
</Steps>

## $OPTIONAL_VARIATION

Cover optional branches or advanced configuration after readers reach a working result.

## Troubleshooting

Add this section only for known failures. Name the symptom, then the fix.

## Related

- [$FEATURE](/docs/$CATEGORY/$FEATURE)
- [$REFERENCE](/reference/$CATEGORY/$REFERENCE)
````

Use a Markdown ordered list instead of `Steps` when each step is a single short sentence.

## Self-review checklist

Run `CHECKLIST.md`, then:

- [ ] Does the H1 start with an imperative verb?
- [ ] Does the opening state the result before the first action?
- [ ] Is each prerequisite listed before the first action that needs it?
- [ ] Are the steps in dependency order, with nothing a reader must do left implicit?
- [ ] Does the last required step give a command, URL, interface action, or expected output that verifies the result?
- [ ] Do optional branches and advanced configuration come after the working result?
- [ ] Is each `StepItem` one action, not several unrelated actions?

## Example

`docs/src/content/en/docs/mastra-platform/deploy.mdx` shows the structure: a result-first opening, `## Before you begin`, a `Steps` sequence, later variations, and `## Related`. Its frontmatter predates the `packages` requirement; include `packages` in new pages.

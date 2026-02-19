# Guide page styleguide

This styleguide covers the page types found in `docs/src/content/en/guides/`. Guides are task-oriented — they walk the reader through building something from start to finish.

Also read and follow the general [STYLEGUIDE.md](./STYLEGUIDE.md) for tone, readability, and formatting rules that apply to all documentation.

## Quickstart guide

### Purpose

A quickstart guide gets the reader from zero to a working result as fast as possible. It focuses on one specific integration or setup scenario (e.g. "Mastra + Next.js") and produces a tangible outcome the reader can see and interact with.

### Template

````mdx
---
title: '$TECHNOLOGY | $CATEGORY'
description: '$VERB with Mastra and $TECHNOLOGY'
---

# $ACTION_ORIENTED_TITLE

One sentence explaining what you'll build and what technologies you'll use. Link to external docs for technologies the reader may not know.

## Before you begin

- Prerequisite 1 (e.g. API key, link to where to get one)
- Prerequisite 2 (e.g. Node.js version)

## Create a new $TECHNOLOGY app (optional)

Brief context sentence.

```bash npm2yarn
npx create-something@latest my-project
```

One sentence explaining what the command did.

## Initialize Mastra

Brief context sentence.

```bash npm2yarn
npx mastra@latest init
```

Explain what was created and which files matter for the next steps.

## $STEP_3

Brief context sentence.

```bash npm2yarn
npm install @mastra/package@latest
```

## $STEP_N

Brief context sentence explaining what this code does.

```typescript title="src/path/to/file.ts"
// Complete, working code the reader can copy
```

One to two sentences explaining the key parts of the code. Focus on the "why" — the reader can see the "what" in the code itself.

## Test your $THING

Numbered steps to verify everything works:

1. Run the app with `npm run dev`
2. Open http://localhost:3000
3. Try doing X. You should see Y

## Next steps

Congratulations message (one sentence).

From here, you can extend the project:

- [Link to deeper docs](/docs/category/page)
- [Link to related guide](/guides/category/page)
- [Link to deployment](/guides/deployment/page)
````

### Rules

1. **Title format**: Use `"$TECHNOLOGY | $CATEGORY"` in frontmatter (e.g. `"Next.js | Frameworks"`). No `packages` field — quickstarts aren't tied to a single package.
2. **H1 is action-oriented**: Use a verb phrase describing the outcome (e.g. "Integrate Mastra in your Next.js project"), not just the technology name.
3. **"Before you begin" section**: List prerequisites as bullets. Link to where the reader can get API keys or install required tools. Keep it short — don't explain what the prerequisites are, just state them.
4. **Each H2 is one step**: The reader should be able to follow the guide top-to-bottom without jumping around. Each H2 represents a single action (create, install, configure, build). Mark optional steps in the heading (e.g. "Create a new app (optional)").
5. **Code first, explanation after**: Show the code block, then explain what it does. The reader scans for code — put it where they'll find it.
6. **Complete, copyable code**: Every code block should work when copied. Don't use pseudo-code or partial snippets. Include all imports. Use `title` attributes for file paths so the reader knows where to put the code.
7. **"Test your X" section**: Always include a verification step with numbered instructions. The reader should be able to confirm the guide worked before moving on.
8. **Close with "Next steps"**: Start with a short congratulations, then link to deeper docs and related guides. Group links by intent (extend the project vs. deploy it).
9. **No `<Steps>` component**: Quickstarts use H2 headings as steps, not the `<Steps>` MDX component. The H2 headings provide better navigation and allow longer content per step.
10. **Use `npm2yarn` on all install commands**: Always add the `npm2yarn` flag to bash blocks containing `npm install` or `npx` commands.

### Example: Next.js quickstart

See [next-js.mdx](../src/content/en/guides/getting-started/next-js.mdx) for the gold-standard implementation of this template.

Key structural elements from that guide:

```md
# Integrate Mastra in your Next.js project ← action-oriented H1

One-sentence summary + technologies used

## Before you begin ← prerequisites

## Create a new Next.js app (optional) ← optional step marked in heading

## Initialize Mastra ← step: setup

## Install AI SDK UI & AI Elements ← step: dependencies

## Create a chat route ← step: backend code

## Create a chat page ← step: frontend code

## Test your agent ← verification

## Next steps ← links forward
```

## Deployment guide

### Purpose

A deployment guide walks the reader through deploying their Mastra application to a specific platform. It covers installation, configuration, the deploy process itself, and platform-specific concerns. The reader already has a working Mastra app — this guide gets it running in production.

### Template

````mdx
---
title: 'Deploy Mastra to $PLATFORM | Deployment'
description: 'Learn how to deploy a Mastra application to $PLATFORM'
---

import Steps from '@site/src/components/Steps'
import StepItem from '@site/src/components/StepItem'

# Deploy Mastra to $PLATFORM

One to two sentences explaining what the deployer does and how it works. Link to the platform's relevant docs.

:::note
Scope clarification — what this guide covers and what it doesn't. Link to alternatives (e.g. server adapters, web framework integration) if the reader might be in the wrong place.
:::

## Before you begin

You'll need a [Mastra application](/guides/getting-started/quickstart) and a [$PLATFORM](https://platform.com/) account.

Call out any platform constraints that affect configuration choices (e.g. ephemeral filesystem, cold starts, storage requirements).

## Installation

Add the deployer package:

```bash npm2yarn
npm install @mastra/deployer-$PLATFORM@latest
```

Import the deployer and set it in the Mastra configuration:

```typescript title="src/mastra/index.ts"
import { Mastra } from '@mastra/core'
import { $PlatformDeployer } from '@mastra/deployer-$PLATFORM'

export const mastra = new Mastra({
  deployer: new $PlatformDeployer(),
})
```

## Deploy

<Steps>
<StepItem>

Push/connect step — how to get the code to the platform.

</StepItem>
<StepItem>

Trigger the deploy — what command to run or button to click.

:::note
Remind the reader to set environment variables.
:::

</StepItem>
<StepItem>

Verify the deployment — a URL or command to confirm it's working.

</StepItem>
</Steps>

## Optional overrides (if applicable)

Brief description of configuration options. Link to the deployer reference for the full list.

## $PLATFORM_SPECIFIC_CONCERN (if applicable)

Explain platform-specific gotchas (e.g. observability flush for serverless, cold start mitigation). Include a code example if the reader needs to add code to handle it.

```typescript title="src/path/to/file.ts"
// Code addressing the platform concern
```

:::warning
Explain the limitation and link to alternatives if applicable.
:::

## Related

- [$PlatformDeployer reference](/reference/deployer/$PLATFORM)
- [Deployment overview](/docs/deployment/overview)
- [Related guide or doc](/docs/category/page)
````

### Rules

1. **Title format**: Use `"Deploy Mastra to $PLATFORM | Deployment"` in frontmatter. The H1 should match the title.
2. **Scope clarification**: Include a `:::note` block after the intro if this guide only covers one deployment method and alternatives exist. Don't let the reader follow the wrong guide.
3. **"Before you begin" section**: State that the reader needs a working Mastra app (link to the quickstart) and a platform account. Call out platform constraints that affect configuration — ephemeral filesystems, storage requirements, etc.
4. **Installation = package + config**: The installation section always has two parts: install the deployer package (`bash npm2yarn`), then show the Mastra config with the deployer set.
5. **Use `<Steps>` for the deploy sequence**: Unlike quickstarts, deployment guides use the `<Steps>` component for the deploy process. Deploy steps are short and sequential — `<Steps>` keeps them compact.
6. **Verification inside Steps**: Include the verification as the last `<StepItem>`, not as a separate H2. Deployment verification is part of the deploy flow, not a standalone section.
7. **Platform-specific sections**: Add H2 sections for platform concerns the reader must know about (observability, cold starts, auth). These come after the deploy section. Include code examples and `:::warning` blocks for limitations.
8. **Close with "Related"**: Link to the deployer reference, the deployment overview, and related guides. No congratulations message — deployment guides are reference-like.
9. **Use `npm2yarn` on install commands**: Same as quickstarts.

### Example: Vercel deployment

See [vercel.mdx](../src/content/en/guides/deployment/vercel.mdx) for the gold-standard implementation of this template.

Key structural elements from that guide:

```md
# Deploy Mastra to Vercel ← action-oriented H1

What the deployer does + how it works
:::info
scope clarification ← what this guide covers
:::

## Before you begin ← prerequisites + platform constraints

## Installation ← package install + Mastra config

## Deploy ← <Steps> component with push, deploy, verify

## Optional overrides ← link to deployer reference

## Observability ← platform-specific concern with code + warning

## Related ← links to reference and related docs
```

## Guide tutorial

### Purpose

A guide tutorial teaches the reader how to build something specific with Mastra. Unlike quickstarts (which get to a working result as fast as possible), tutorials go deeper — each step teaches a concept while building toward a complete project. The reader already has a Mastra project set up.

### Template

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

### Rules

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

### Example: Code review bot

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

# Styleguide: Deployment guide

A deployment guide walks the reader through deploying their Mastra application to a specific platform. It covers installation, configuration, the deploy process itself, and platform-specific concerns. The reader already has a working Mastra app — this guide gets it running in production.

Also read and follow the general [STYLEGUIDE.md](./STYLEGUIDE.md) for tone, readability, and formatting rules that apply to all documentation.

## Template

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

## Rules

1. **Title format**: Use `"Deploy Mastra to $PLATFORM | Deployment"` in frontmatter. The H1 should match the title.
2. **Scope clarification**: Include a `:::note` block after the intro if this guide only covers one deployment method and alternatives exist. Don't let the reader follow the wrong guide.
3. **"Before you begin" section**: State that the reader needs a working Mastra app (link to the quickstart) and a platform account. Call out platform constraints that affect configuration — ephemeral filesystems, storage requirements, etc.
4. **Installation = package + config**: The installation section always has two parts: install the deployer package (`bash npm2yarn`), then show the Mastra config with the deployer set.
5. **Use `<Steps>` for the deploy sequence**: Unlike quickstarts, deployment guides use the `<Steps>` component for the deploy process. Deploy steps are short and sequential — `<Steps>` keeps them compact.
6. **Verification inside Steps**: Include the verification as the last `<StepItem>`, not as a separate H2. Deployment verification is part of the deploy flow, not a standalone section.
7. **Platform-specific sections**: Add H2 sections for platform concerns the reader must know about (observability, cold starts, auth). These come after the deploy section. Include code examples and `:::warning` blocks for limitations.
8. **Close with "Related"**: Link to the deployer reference, the deployment overview, and related guides. No congratulations message — deployment guides are reference-like.
9. **Use `npm2yarn` on install commands**: Same as quickstarts.

## Example: Vercel deployment

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

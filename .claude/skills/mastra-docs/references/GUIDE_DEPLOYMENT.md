# Deployment guide styleguide

Read STYLEGUIDE.md first.

Use this file for deployment guides.

Goal:

- assume the reader already has a working Mastra app
- show how to deploy it to one platform
- cover install, config, deploy, and platform-specific concerns

Use this shape:

````mdx
---
title: 'Deploy Mastra to $PLATFORM | Deployment'
description: 'Learn how to deploy a Mastra application to $PLATFORM'
---

import Steps from '@site/src/components/Steps';
import StepItem from '@site/src/components/StepItem';

# Deploy Mastra to $PLATFORM

One or two sentences on what the deployer does and how it works. Link to the platform docs.

:::note
Clarify scope. Say what this guide covers and what it does not. Link to alternatives if the reader may be in the wrong guide.
:::

## Before you begin

You'll need a [Mastra application](/guides/getting-started/quickstart) and a [$PLATFORM](https://platform.com/) account.

Call out platform constraints that affect config, such as ephemeral filesystems, cold starts, or storage requirements.

## Installation

Add the deployer package:

```bash npm2yarn
npm install @mastra/deployer-$PLATFORM@latest
```

Import the deployer and set it in the Mastra config:

```typescript title="src/mastra/index.ts"
import { Mastra } from '@mastra/core';
import { $PlatformDeployer } from '@mastra/deployer-$PLATFORM';

export const mastra = new Mastra({
  deployer: new $PlatformDeployer(),
});
```

## Deploy

<Steps>
<StepItem>

Push or connect the code to the platform.

</StepItem>
<StepItem>

Trigger the deploy. Show the command to run or the action to take.

:::note
Remind the reader to set environment variables.
:::

</StepItem>
<StepItem>

Verify the deployment with a URL or command.

</StepItem>
</Steps>

## Optional overrides

Briefly describe config options. Link to the deployer reference for the full list.

## $PLATFORM_SPECIFIC_CONCERN

Explain platform-specific gotchas, such as observability flush or cold start mitigation. Add code if the reader needs to change code to handle it.

```typescript title="src/path/to/file.ts"
// Code addressing the platform concern
```

:::warning
Explain the limitation and link to alternatives when needed.
:::

## Related

- [$PlatformDeployer reference](/reference/deployer/$PLATFORM)
- [Deployment overview](/docs/deployment/overview)
- [Related guide or doc](/docs/category/page)
````

Rules:

- frontmatter title must be `Deploy Mastra to $PLATFORM | Deployment`
- H1 must match the title without the category suffix
- add the note after the intro when the guide covers only one deployment path and alternatives exist
- Before you begin must require a working Mastra app and a platform account
- call out platform constraints that affect configuration
- Installation must include both package install and Mastra config
- use `bash npm2yarn` on install commands
- use `<Steps>` for the deploy flow
- keep verification as the last `StepItem`, not a separate H2
- add platform-specific H2 sections after Deploy when needed
- include code and warning blocks for platform limitations when needed
- end with Related
- do not add a congratulations section

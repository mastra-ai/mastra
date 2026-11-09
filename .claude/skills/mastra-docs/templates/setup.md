# Setup and configuration page template

Guide: `references/DOC.md` (Setup and configuration pages).

## Purpose

Answers: "How do I enable this Mastra feature, and which settings change its behavior?"

Use it for a Mastra-owned feature that readers install, register, or configure, such as an auth provider class, storage, or a server option. The page states the supported setup, defaults, and the difference between local and production configuration.

Don't use it for:

- a one-off task with a single verifiable outcome, such as deploying (use `how-to.md`);
- an external product's setup, such as a database host or a framework (use `integration.md`);
- a complete option list (use `reference-api.md` and link to it);
- explaining a mental model with little configuration (use `concept.md`).

## Title grammar

- `title` follows `$FEATURE | $CATEGORY`, such as `JSON Web Token | Auth`.
- The H1 names the feature as a noun phrase, such as `JSON Web Token`.
- Don't prefix the title with `Configure` or `Set up` unless neighboring pages do.

## Frontmatter

```yaml
---
title: '$FEATURE | $CATEGORY'
description: 'Enable and configure $FEATURE, including $KEY_SETTINGS.'
packages:
  - '@mastra/core'
  - '@mastra/$PACKAGE'
---
```

## Skeleton

````mdx
---
title: '$FEATURE | $CATEGORY'
description: 'Enable and configure $FEATURE, including $KEY_SETTINGS.'
packages:
  - '@mastra/core'
  - '@mastra/$PACKAGE'
---

# $FEATURE

Say what the feature does and what readers have once it's configured.

## Installation

```bash npm2yarn
npm install @mastra/$PACKAGE@latest
```

## Configure $FEATURE

Show the smallest supported configuration and say where it goes.

```typescript title="src/mastra/index.ts"
import { Mastra } from '@mastra/core';
import { $CLASS } from '@mastra/$PACKAGE';

export const mastra = new Mastra({
  $OPTION: new $CLASS({
    $SETTING: process.env.$ENV_VAR,
  }),
});
```

Visit the [`$CLASS` reference](/reference/$CATEGORY/$CLASS) for all options.

## Verify the configuration

Give a command, request, or Studio action that shows the feature works, and the expected result.

## Defaults

State the defaults that affect behavior, such as where data is stored or what happens when an option is omitted.

## Production configuration

Separate production requirements from local development assumptions, such as persistent storage, secrets, or network access.

## Related

- [`$CLASS` reference](/reference/$CATEGORY/$CLASS)
- [$RELATED_FEATURE](/docs/$CATEGORY/$RELATED_FEATURE)
````

## Self-review checklist

Run `CHECKLIST.md`, then:

- [ ] Does the page start with the supported setup before alternatives or advanced options?
- [ ] Does every required environment variable appear with its name and where to set it?
- [ ] Does the page give a way to verify the configuration and say what readers should see?
- [ ] Are defaults and persistence boundaries stated where they affect behavior?
- [ ] Are local development assumptions separated from production requirements?
- [ ] Does the page link to the reference page instead of listing every option?

## Example

`docs/src/content/en/docs/auth/jwt.mdx`

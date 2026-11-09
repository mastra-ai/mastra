# Integration guide template

Guide: `references/GUIDE_INTEGRATION.md`.

## Purpose

Answers: "How do I use Mastra with $PRODUCT?"

Use it to connect Mastra to an external framework, platform, deployment target, database, or service under `/integrations` or the section that owns that integration.

Don't use it for:

- Mastra's own features (use `concept.md`, `setup.md`, or `how-to.md`);
- the full API of a Mastra adapter package (use `reference-api.md`, and link to it);
- re-documenting the external product. Link to its docs instead.

## Title grammar

- `title` follows `$PRODUCT | $SIDEBAR_CATEGORY`, such as `Hono | Frameworks`. Deployment pages use `$PLATFORM | Deploy`.
- Follow the pattern used by neighboring pages in the same category. Don't add a prefix only to fit this template.
- The H1 is the product name, such as `Hono`.

## Frontmatter

```yaml
---
title: '$PRODUCT | $SIDEBAR_CATEGORY'
description: 'Integrate Mastra with $PRODUCT to $RESULT.'
packages:
  - '@mastra/core'
  - '@mastra/$ADAPTER'
---
```

## Skeleton

````mdx
---
title: '$PRODUCT | $SIDEBAR_CATEGORY'
description: 'Integrate Mastra with $PRODUCT to $RESULT.'
packages:
  - '@mastra/core'
  - '@mastra/$ADAPTER'
---

# $PRODUCT

$OPENING: what Mastra and [$PRODUCT]($PRODUCT_DOCS_URL) do together, what readers build, and what the integration gives them that they wouldn't get otherwise. Don't open with a fixed formula such as "In this guide".

## Before you begin

- Accounts, API keys, and versions readers need, such as Node.js `v22.13.0` or later.
- An existing $PRODUCT project, or a link to create one.

## Install packages

```bash npm2yarn
npm install @mastra/$ADAPTER@latest
```

## Configure $PRODUCT

Show the smallest working configuration and say which file it goes in.

```typescript title="src/index.ts"
import { $EXPORT } from '@mastra/$ADAPTER';
import { mastra } from './mastra/index.js';

// Minimal integration code
```

Add environment variables when needed:

```bash title=".env"
$PRODUCT_API_KEY=your-api-key
```

## Test the integration

Give a command or request and the expected response, so readers can confirm it works.

```bash
curl http://localhost:3000/$ROUTE
```

## Limitations

Platform constraints, unsupported features, and security considerations. Remove this section if there are none.

## Next steps

- [$ADAPTER reference](/reference/$CATEGORY/$ADAPTER)
- [$PRODUCT documentation]($PRODUCT_DOCS_URL)
````

Use `Steps` and `StepItem` (imported from `@site/src/components/Steps` and `@site/src/components/StepItem`) instead of `##` sections when the setup is one short ordered sequence.

## Self-review checklist

Run `CHECKLIST.md`, then:

- [ ] Does the title follow the pattern of neighboring pages in the same sidebar category?
- [ ] Are product versions, prerequisites, and required accounts listed before the first step?
- [ ] Is the integration code checked against the adapter's exports and tests?
- [ ] Are secrets read from environment variables and never hardcoded?
- [ ] Does the page end with a verifiable result, such as a request and its expected response or a successful deployment?
- [ ] Are platform limits and security concerns stated?
- [ ] Do links point to the external product's own docs instead of repeating them?

## Example

`docs/src/content/en/integrations/frameworks/hono.mdx`

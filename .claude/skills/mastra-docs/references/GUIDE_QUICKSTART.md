# Quickstart guide styleguide

Read STYLEGUIDE.md first.

Use this file for quickstarts.

Goal:

- get the reader to a working result fast
- focus on one setup or integration
- produce something the reader can run or interact with

Use this shape:

````mdx
---
title: '$TECHNOLOGY | $CATEGORY'
description: '$VERB with Mastra and $TECHNOLOGY'
---

# $ACTION_ORIENTED_TITLE

One sentence on what the reader will build and which technologies are used. Link to external docs for unfamiliar technologies.

## Before you begin

- Prerequisite 1
- Prerequisite 2

## Create a new $TECHNOLOGY app (optional)

Brief context.

```bash npm2yarn
npx create-something@latest my-project
```

One sentence on what the command did.

## Initialize Mastra

Brief context.

```bash npm2yarn
npx mastra@latest init
```

Explain what was created and which files matter next.

## $STEP_3

Brief context.

```bash npm2yarn
npm install @mastra/package@latest
```

## $STEP_N

Brief context on what this code does.

```typescript title="src/path/to/file.ts"
// Complete, working code the reader can copy
```

One or two sentences on the key parts. Focus on why, not what.

## Test your $THING

1. Run the app with `npm run dev`
2. Open http://localhost:3000
3. Try doing X. You should see Y

## Next steps

Short congratulations sentence.

From here, extend the project:

- [Link to deeper docs](/docs/category/page)
- [Link to related guide](/guides/category/page)
- [Link to deployment](/guides/deployment/page)
````

Rules:

- frontmatter title must be `$TECHNOLOGY | $CATEGORY`
- do not add a `packages` field
- H1 must be action-oriented, not just a technology name
- Before you begin must be short bullet prerequisites with links where needed
- each H2 must be one step in sequence
- mark optional steps in the heading
- show code before explanation
- every code block must be complete and copyable
- include all imports in code blocks
- use `title` for file paths
- use `npm2yarn` on `npm install`, `npx`, and similar bash commands
- do not use the `<Steps>` component
- always include `Test your $THING` with numbered verification steps
- end with Next steps
- start Next steps with a short congratulations line
- group follow-up links by intent

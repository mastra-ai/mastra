# Styleguide: Quickstart guide

This styleguide covers the "Quickstart" page type found in `docs/src/content/en/guides/`. A quickstart guide gets the reader from zero to a working result as fast as possible. It focuses on one specific integration or setup scenario (e.g. "Mastra + Next.js") and produces a tangible outcome the reader can see and interact with.

Also read and follow the general [STYLEGUIDE.md](./STYLEGUIDE.md) for tone, readability, and formatting rules that apply to all documentation.

## Template

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

## Rules

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

## Example: Next.js quickstart

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

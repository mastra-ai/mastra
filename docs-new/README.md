# **Contributing to the Docs**

Contributions to Mastra are welcome and highly appreciated.
If you'd like to contribute, see our list of open issues. We also welcome you to open a PR or a new issue with your question.

The first step is to clone the Repo

```bash
git clone git@github.com:mastra-ai/mastra.git
cd docs
```

## Environmental Variables

Some features of the docs won't work unless you have private keys for these projects.
These include:

- posthog
- form subscription
- analytics
- chatbot
- algolia search

Copy the Env file:

```bash
cp .env.example .env
```

## Dev Preview

Install the packages

```bash
npm i
```

> The docs have a separate `package.json` file and is not part of the workspace so please do not use

Run the appropriate CLI command in your terminal:

```bash
npm start
```

The docs will be served on `localhost:3000/docs`.

## Search

Search is implemented with Algolia. To set up search functionality:

1. Create an Algolia account and application
2. Set up your environment variables in `.env.local`:

```bash
   NEXT_PUBLIC_ALGOLIA_APP_ID=your_app_id
   NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY=your_search_key
```

3. Index your documentation content in Algolia

For detailed setup instructions, see [ALGOLIA_SETUP.md](./ALGOLIA_SETUP.md).

## Making Changes

The Mastra docs use [MDX](https://mdxjs.com/).

Adding new content requires:

- YAML frontmatter
- A navigation entry in a `meta.ts` file
- Content for the docs

Frontmatter looks like this. title and description are mandatory.

```bash
---
title: "Introduction | Mastra Docs"
description: "Mastra is a TypeScript agent framework. It helps you build AI applications and features quickly. It gives you the set of primitives you need: workflows, agents, RAG, integrations, syncs and evals."
---
```

Navigation is defined in a relative `meta.ts` file. It modifies the title of the content in the sidebar

```ts
const meta = {
  overview: "Overview",
};

export default meta;
```

### Components and elements

Mastra is built on [Nextra](https://nextra.site/docs) and therefore we use custom components that `Nextra` provides which includes `callouts`, `Tabs` e.t.c

You can find the full list [on the nextra site](https://nextra.site/docs/built-ins)

### Guidelines

**Finding Something to Work On:**

1. Check the open issues labeled 'documentation' or 'good first issue'.
2. Identify areas that are unclear, missing, or incorrect.

**Making Changes:**

1. Create a new branch for your changes (`git checkout -b my-docs-update`).
2. Make your desired edits to the documentation files (usually found in the `docs/en` directory).
3. Commit your changes with clear and concise messages.

**Style Guide:**

1. Ensure your writing is clear, concise, and uses consistent formatting.

**Submitting Changes:**

1. Push your branch to your fork (`git push origin my-docs-update`).
2. Open a Pull Request (PR) against the main repository's `main` branch.
3. Clearly describe the changes you've made in the PR description.

**Review Process:**

1. Maintainers will review your PR.
2. Address any feedback or requested changes.
3. Once approved, your changes will be merged.

We appreciate your contributions to improving our documentation.

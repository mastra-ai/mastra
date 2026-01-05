# Contributing to Mastra's documentation

We welcome contributions of any size and contributors of any skill level.

> **Tip for new contributors:**
> Take a look at [GitHub's Docs](https://docs.github.com/en/get-started/quickstart/hello-world) and [https://github.com/firstcontributions/first-contributions](https://github.com/firstcontributions/first-contributions) for helpful information on working with GitHub.

## Types of Contributions

There are lots of ways to contribute to the Mastra documentation website!

The Mastra documentation website is a Docusaurus site. Maintaining it requires not only written content but also maintaining code and addressing a11y, CSS, UI, and UX concerns.

We encourage you to:

- **File an Issue** to let us know of outdated, confusing, or incorrect documentation. You can also let us know of any problems you encounter on the site itself.
- **Make a PR directly** for very obvious documentation fixes like typos or broken links.

We provide new content and rework existing content in response to GitHub Issues.

Larger contributions to the docs are encouraged after participating in Issues, as unsolicited material may not fit into our existing plans.

### Examples of Helpful GitHub Issues

- A particular explanation is confusing (with explanation)
- A code example is wrong (with or without a proposed fix)
- Accessibility (a11y) issues discovered
- Missing content
- A request for an example of how to implement a specific feature (e.g. multi-agent workflows, RAG integration)

### Examples of Helpful GitHub PRs

- PRs addressing an existing Issue
- Unsolicited PRs to address typos, broken links, and other minor problems

## Guidelines for Contributing

### Documentation Structure

The Mastra documentation are organized into several sections:

- **docs/** - Main documentation (`src/content/en/docs/`)
- **guides/** - Step-by-step guides (`src/content/en/guides/`)
- **examples/** - Example implementations (`src/content/en/examples/`)
- **reference/** - API reference documentation (`src/content/en/reference/`)
- **models/** - Model provider documentation (`src/content/en/models/`). These docs are auto-generated and should not be edited manually.
- **course/** - Tutorial and course content (`src/course/`)

All documentation should be written in English and placed in the appropriate section under `docs/src/content/en/`.

### Frontmatter Requirements

All MDX files should include frontmatter with `title` and `description`. For documentation that relates to specific Mastra packages, add a `packages` field:

```yaml
---
title: "Memory Overview"
description: "Learn about Mastra's memory system"
packages:
  - "@mastra/memory"
  - "@mastra/core"
---
```

The `packages` field enables embedded documentation generation for npm packages, allowing coding agents to access relevant docs directly from `node_modules`. See [EMBEDDED_DOCS.md](/EMBEDDED_DOCS.md) for more details.

### Edit this Page via GitHub

Every page on [mastra.ai](https://mastra.ai/) has an **Edit this page** link. You can click that link to edit the source code for that page in **GitHub**.

After you make your changes, click **Commit changes**.
This will automatically create a [fork](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/working-with-forks/about-forks) of the docs in your GitHub account with the changes.

Once you have committed your edits to your fork, follow the prompts to **create a pull request** and submit your changes for review.

Every pull request needs to be reviewed by our contributors and approved by a maintainer.

### Contribute PRs by Developing Locally

To begin developing locally, checkout this project from your machine.

```shell
git clone git@github.com:mastra-ai/mastra.git
cd mastra/docs
```

You can install and run the project locally using [npm](https://www.npmjs.com/). The docs use npm as their package manager (not pnpm like the rest of the monorepo). Run the following from your terminal in the `docs` directory:

```shell
npm install

npm run dev
```

This will start a local development server at `http://localhost:3000` where you can preview your changes.

If you're copying these instructions, remember to [configure this project as a fork](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/working-with-forks/configuring-a-remote-repository-for-a-fork).

```shell
git remote add upstream git@github.com:mastra-ai/mastra.git
```

At any point, create a branch for your contribution. We are not strict about branch names.

```shell
git checkout -b docs/fix-agent-example-typo
```

### Testing Your Changes

Before submitting a PR, make sure to:

1. **Build the docs locally** to check for any build errors:

   ```shell
   npm run build
   ```

2. **Preview the production build**:

   ```shell
   npm run serve
   ```

3. **Check for broken links** - The build process will warn you about broken links.

4. **Verify code examples** - If you've added code examples, test them if possible to ensure they work.

### Opening a PR

Once you have made your changes using any of the above methods, you're ready to create a Pull Request!

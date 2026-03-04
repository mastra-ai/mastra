# Contributing to Mastra's documentation

We welcome contributions of any size and contributors of any skill level.

> **Tip for new contributors:**
> Take a look at [GitHub's Docs](https://docs.github.com/en/get-started/quickstart/hello-world) and [https://github.com/firstcontributions/first-contributions](https://github.com/firstcontributions/first-contributions) for helpful information on working with GitHub.

## Project setup

To begin developing locally, check out this project from your machine.

```shell
git clone git@github.com:mastra-ai/mastra.git
pnpm install
```

Run the following from your terminal in the `docs` directory:

```shell
cd docs

pnpm run dev
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

### Testing your changes

Before submitting a PR, make sure to:

1. **Build the docs locally** to check for any build errors:

   ```shell
   pnpm run build
   ```

2. **Preview the production build**:

   ```shell
   pnpm run serve
   ```

3. **Check for broken links** - The build process will warn you about broken links.

4. **Verify code examples** - If you've added code examples, test them if possible to ensure they work.

## Documentation structure

The Mastra documentation is organized into several sections:

- **docs/** - Main documentation (`src/content/en/docs/`)
- **guides/** - Step-by-step guides (`src/content/en/guides/`)
- **reference/** - API reference documentation (`src/content/en/reference/`)
- **models/** - Model provider documentation (`src/content/en/models/`). These docs are auto-generated and should not be edited manually.
- **course/** - Tutorial and course content (`src/course/`)

All documentation should be written in English and placed in the appropriate section under `docs/src/content/en/`.

## Editing content

All documentation content is located in `/src`. Mastra's documentation content is written in a variation of Markdown called MDX, which allows embedding React components directly in content. The site also supports GitHub Flavored Markdown, adding support for tables and task lists.

### File metadata

Each file has a few required frontmatter fields, which are defined like so:

```yaml
---
title: 'Memory Overview'
description: 'Learn about Mastra's memory system'
packages:
  - '@mastra/memory'
  - '@mastra/core'
---
```

- `title`: The title of the page. Used to populate the HTML `<title>` tag
- `description`: A short description of the page's content. Used in the HTML `<meta name="description">` tag for SEO purposes.
- `packages`: An array of npm packages that are relevant to the content on the page. Enables embedded docs, see [EMBEDDED_DOCS.md](../scripts/EMBEDDED_DOCS.md) for more details.

### Headings

Headings should be nested by their rank. Headings with an equal or higher rank start a new section, headings with a lower rank start new subsections that are part of the higher-ranked section.

All headings should be written in sentence-casing, where only the first word of the heading is capitalized. Example: "This is a heading".

### Code blocks

Syntax-highlighted code blocks are rendered wherever Markdown code blocks are used. To add syntax highlighting, specify a language next to the backticks before the fenced code block.

````md
```typescript
function add(a: number, b: number) {
  return a + b
}
```
````

You can also specify a filename by passing the `title` prop.

````md
```typescript title="add.ts"
function add(a: number, b: number) {
  return a + b
}
```
````

#### Highlighting

You can highlight specific lines in a code block using the `{}` notation. For example, to highlight line 2 and lines 5-7:

````md
```typescript {2,5-7}
function add(a: number, b: number) {
  return a + b
}
```
````

Alternatively you can use `// highlight-next-line` and `// highlight-start` / `// highlight-end` comments to specify which lines to highlight.

````md
```typescript
function add(a: number, b: number) {
  // highlight-next-line
  return a + b
}
```
````

### `npm install` code blocks

When including `npm install` code blocks, please use the following format to ensure consistent styling across the documentation:

````md
```bash npm2yarn
npm install @mastra/core
```
````

By including `npm2yarn` after `bash`, the documentation site will automatically generate a toggle that allows users to switch between different package managers.

### Admonitions

In addition to the basic Markdown syntax, we have a special admonitions syntax by wrapping text with a set of 3 colons, followed by a label denoting its type.

Example:

```md
:::note

Some **content** with _Markdown_ `syntax`. Check [this `api`](#).

:::

:::tip

Some **content** with _Markdown_ `syntax`. Check [this `api`](#).

:::

:::info

Some **content** with _Markdown_ `syntax`. Check [this `api`](#).

:::

:::warning

Some **content** with _Markdown_ `syntax`. Check [this `api`](#).

:::

:::danger

Some **content** with _Markdown_ `syntax`. Check [this `api`](#).

:::
```

### `<Tabs>`

Docusaurus provides the `<Tabs>` component that you can use in Markdown thanks to MDX:

```mdx
import Tabs from '@theme/Tabs'
import TabItem from '@theme/TabItem'

<Tabs>
  <TabItem value="apple" label="Apple" default>
    This is an apple 🍎
  </TabItem>
  <TabItem value="orange" label="Orange">
    This is an orange 🍊
  </TabItem>
  <TabItem value="banana" label="Banana">
    This is a banana 🍌
  </TabItem>
</Tabs>
```

### `<PropertiesTable>`

Use this on reference documentation pages to display the parameters and return types of a function, method, or class constructor. You need to use it like so:

```mdx
<PropertiesTable
  content={[
    {
      name: 'id',
      type: 'string',
      isOptional: true,
      description: 'Unique identifier for the agent. Defaults to `name` if not provided.',
    },
  ]}
/>
```

Provide an array of objects with the following properties:

- `name`: The name of the parameter or return type
- `type`: The data type of the parameter or return type
- `isOptional`: A boolean indicating whether the parameter is optional (default: `false`)
- `description`: A brief description of the parameter or return type

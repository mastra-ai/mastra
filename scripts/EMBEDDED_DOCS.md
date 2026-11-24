# Embedded documentation for packages

This documents explains what `generate-package-docs.ts` does and how to use it.

This script is executed to create `dist/docs` folders inside packages that use it. Inside the `docs` folder is a `SKILL.md` defined that points to `dist/docs/references`. It contains a collection of markdown files with relevant documentation for that package.

The `SKILL.md` follows the [Agent Skill Specification](https://agentskills.io/specification) so that coding agents can understand how to use the package effectively.

The documentation files are copied from the `docs`, more specifically the `llms.txt` files that each docs page has. To figure out which package should get which docs, the script uses the `docs/build/llms-manifest.json` file that is generated when building the docs site.

## How to add docs to a package

The `llms-manifest.json` file is generated through the frontmatter in the docs MDX files. The important frontmatter field is `packages`, which is an array of package names that the doc is relevant for.

If not already existent, add the `packages` frontmatter key:

```yaml
---
title: 'Memory Overview'
description: "Learn about Mastra's memory system"
packages:
  - '@mastra/memory'
  - '@mastra/core'
---
```

The entries inside `packages` should match the package names in their `package.json`.

## How to generate embedded docs for a package

Add a `prepack` script and the `tsx` dev dependency to the package's `package.json`. Docs generate only when the package is packed or published, not during regular builds:

```json
{
  "scripts": {
    "prepack": "tsx ../../scripts/generate-package-docs.ts"
  },
  "devDependencies": {
    "tsx": "catalog:"
  }
}
```

Exclude generated docs from the build outputs in the package's `turbo.json` so cached builds don't restore stale docs:

```json
{
  "tasks": {
    "build": {
      "outputs": ["dist/**", "!dist/docs/**"]
    }
  }
}
```

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

Add a `build:docs` script to the package's `package.json`:

```json
{
  "scripts": {
    "build": "your-existing-build-command",
    "build:docs": "pnpx tsx ../../scripts/generate-package-docs.ts"
  }
}
```

Add the `build:docs` script to the package's `turbo.json` file so that it runs during the build phase:

```json
{
  "$schema": "https://turbo.build/schema.json",
  "extends": ["//"],
  "tasks": {
    "build:docs": {
      "inputs": ["src/**", "package.json", "!**/*.md"],
      "outputs": ["dist/docs/**"]
    },
    "build": {
      "dependsOn": ["build:docs"],
      "inputs": ["package.json"]
    }
  }
}
```

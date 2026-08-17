---
name: mastra-docs
description: Documentation guidelines for Mastra. This skill should be used when writing or editing documentation for Mastra. Triggers on tasks involving documentation creation or updates.
---

# Mastra Documentation Guidelines

Use this skill when you create or update Mastra docs. Keep the docs clear and consistent. Follow the most specific AGENTS.md for the area you change. After making your changes to the docs and sidebars, run the linters to check your work.

## Styleguides

Start with references/STYLEGUIDE.md for all docs. Then use the guide that matches the content:

- references/DOC.md: General docs that do not fit the categories below
- Choose the right guide for the file's content:
  - references/GUIDE_QUICKSTART.md: Quickstarts that help readers get working fast with a specific library or framework
  - references/GUIDE_TUTORIAL.md: Tutorials that teach readers how to build something with Mastra
  - references/GUIDE_INTEGRATION.md: Integration guides for using Mastra with an external library or ecosystem
  - references/GUIDE_DEPLOYMENT.md: Deployment guides for shipping a Mastra app to a platform
- references/REFERENCE.md: Reference and API docs
- references/DIAGRAM.md: Any doc containing a Mermaid diagram

To replace an existing diagram image with Mermaid, use the docs-diagrams skill.

## Linting

Use these tools to keep docs consistent:

- oxfmt: Formats docs code, Markdown, config, and style files through the docs-local config.
- oxfmt-mdx: Formats MDX through the docs-local custom parser so admonitions, JSX expressions, and fenced code blocks remain supported.
- remark: Checks markdown issues like heading levels, list styles, and formatting consistency. This is the middle layer.
- vale: Checks grammar, style, and wording. This is the top layer.
  - In order to use Vale, you must download the Vale binary and install `mdx2vast` globally. `pnpm run vale:download`, `npm install -g mdx2vast`.

Run these commands in docs/:

- pnpm run format: Format docs files with oxfmt and docs-local oxfmt-mdx
- pnpm run format:check: Check docs formatting with oxfmt and docs-local oxfmt-mdx
- pnpm run lint:remark: Check MDX with Remark
- pnpm run lint:vale:ai: Check prose with Vale using the error alert level
- pnpm run validate: Check frontmatter values and if all sidebars are valid
- pnpm run generate-vercel-redirects: Generate vercel.json redirects after editing vercel.redirects.json

---
name: mastra-docs
description: Documentation guidelines for Mastra. This skill should be used when writing or editing documentation for Mastra. Triggers on tasks involving documentation creation or updates.
---

# Mastra Documentation Guidelines

Use this skill when you create or update Mastra docs. Keep the docs clear and consistent. Follow the most specific AGENTS.md for the area you change.

## Styleguides

Start with references/STYLEGUIDE.md for all docs. Then use the guide that matches the content:

- references/DOC.md - General docs that do not fit the categories below
- Choose the right guide for the file's content:
  - references/GUIDE_QUICKSTART.md - Quickstarts that help readers get working fast with a specific library or framework
  - references/GUIDE_TUTORIAL.md - Tutorials that teach readers how to build something with Mastra
  - references/GUIDE_INTEGRATION.md - Integration guides for using Mastra with an external library or ecosystem
  - references/GUIDE_DEPLOYMENT.md - Deployment guides for shipping a Mastra app to a platform
- references/REFERENCE.md - Reference and API docs

## Linting

Use these tools to keep docs consistent:

- prettier - Formats files and code blocks. This is the base linting layer.
- remark - Checks markdown issues like heading levels, list styles, and formatting consistency. This is the middle layer.
- vale - Checks grammar, style, and wording. This is the top layer.

Run these commands in docs/:

- npm run format - Format files with Prettier
- npm run lint:remark - Check markdown with Remark
- npm run lint:vale:ai - Check prose with Vale using the error alert level

---
name: mastra-docs
description: Documentation guidelines for Mastra. This skill should be used when writing or editing documentation for Mastra. Triggers on tasks involving documentation creation or updates.
---

# Mastra Documentation Guidelines

Instructions and styleguides for writing and maintaining Mastra documentation. This skill should be used whenever creating or updating documentation for Mastra to ensure consistency, clarity, and quality across all docs.

## Scope

- `@docs/` - This folder contains the source code and contents of the documentation site. All documentation for Mastra should be created and maintained here.
- `@docs/src/content/en/` - This subfolder contains the actual markdown files for the documentation site, organized into `docs/`, `guides/`, and `reference/` sections. The `models/` subfolder contains auto-generated documentation for model providers and should not be edited manually.

## Styleguides

Follow the general styleguide at `@docs/styleguides/STYLEGUIDE.md` for all documentation. Additionally, refer to these specific styleguides when writing different types of documentation:

- `@docs/styleguides/DOC.md` - For any file inside `@docs/src/content/en/docs/`
- For any file inside `@docs/src/content/en/guides/` choose the correct styleguide based on content:
  - `@docs/styleguides/GUIDE_QUICKSTART.md` - For quickstart guides that get the reader to a working result as fast as possible with a specific library/framework.
  - `@docs/styleguides/GUIDE_TUTORIAL.md` - For tutorial guides that teach the reader how to build something specific with Mastra, going deeper into concepts.
  - `@docs/styleguides/GUIDE_INTEGRATION.md` - For integration guides that provide a comprehensive reference for using Mastra with a specific external library or ecosystem.
  - `@docs/styleguides/GUIDE_DEPLOYMENT.md` - For deployment guides that walk the reader through deploying their Mastra application to a specific platform.
- `@docs/styleguides/REFERENCE.md` - For any file inside `@docs/src/content/en/reference/`

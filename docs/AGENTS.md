# AGENTS.md

This file provides guidance to coding agents when working on documentation in this folder.

## Scope guidelines

**IMPORTANT**: Unless explicitly mentioned, always use `@styleguides/STYLEGUIDE.md` as the primary reference for documentation style and formatting. The `@styleguides/` folder contains specific styleguides for different types of documentation (general, guide, reference) which should be followed when applicable.

If you're adding a new feature or changing an existing one, you should always check `src/content/en/docs/` and `src/content/en/reference/` for existing documentation related to that feature. If it exists, update it as needed to reflect the changes. If it doesn't exist, create new documentation in the appropriate section under `src/content/en/docs/` or `src/content/en/reference/`.

## Getting started

Refer to the `@CONTRIBUTING.md` file for instructions on how to set up this project and run it locally.

## Documentation structure

The Mastra documentation is organized into several sections:

- **docs/** - Main documentation (`src/content/en/docs/`)
- **guides/** - Step-by-step guides (`src/content/en/guides/`)
- **reference/** - API reference documentation (`src/content/en/reference/`)
- **models/** - Model provider documentation (`src/content/en/models/`). These docs are auto-generated and should not be edited manually.
- **course/** - Tutorial and course content (`src/course/`)

All documentation should be written in English and placed in the appropriate section under `docs/src/content/en/`.

## Editing content

Always follow the general styleguide at `@styleguides/STYLEGUIDE.md` when writing or editing documentation. Additionally, refer to these styleguides for specific types of documentation:

- `src/content/en/docs/` - `@styleguides/DOC.md`
- For any file inside `@docs/src/content/en/guides/` choose the correct styleguide based on content:
  - `@docs/styleguides/GUIDE_QUICKSTART.md` - For quickstart guides that get the reader to a working result as fast as possible with a specific library/framework.
  - `@docs/styleguides/GUIDE_TUTORIAL.md` - For tutorial guides that teach the reader how to build something specific with Mastra, going deeper into concepts.
  - `@docs/styleguides/GUIDE_INTEGRATION.md` - For integration guides that provide a comprehensive reference for using Mastra with a specific external library or ecosystem.
  - `@docs/styleguides/GUIDE_DEPLOYMENT.md` - For deployment guides that walk the reader through deploying their Mastra application to a specific platform.
- `src/content/en/reference/` - `@styleguides/REFERENCE.md`

Refer to the `@CONTRIBUTING.md` file for instructions on how to set frontmatter and use available MDX components.

## E2E testing

Playwright is used for end-to-end tests. The site must be built before running tests.

```bash
pnpm build                 # Build the Docusaurus site
pnpm test:e2e              # Run all Playwright tests (desktop + tablet + mobile)
pnpm test:smoke            # Smoke tests only (desktop)
pnpm test:og               # OG image meta tag tests only (desktop)
pnpm test:navigation       # Navigation tests (desktop + tablet + mobile)
```

Test files live in `tests/` and helpers in `tests/helpers/`. The Playwright config (`playwright.config.ts`) starts a local server automatically via `pnpm serve`.

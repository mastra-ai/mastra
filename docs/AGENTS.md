# AGENTS.md

This file provides guidance to coding agents when working on documentation in this folder.

## Scope guidelines

**IMPORTANT**: Unless explicitly mentioned, always use `@styleguides/STYLEGUIDE.md` as the primary reference for documentation style and formatting. The `@styleguides/` folder contains specific styleguides for different types of documentation (general, guide, reference) which should be followed when applicable.

## Getting started

Refer to the `@CONTRIBUTING.md` file for instructions on how to setup this project and run it locally.

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
- `src/content/en/guides/` - `@styleguides/GUIDE.md`
- `src/content/en/reference/` - `@styleguides/REFERENCE.md`

Refer to the `@CONTRIBUTING.md` file for instructions on how to set frontmatter and use available MDX components.

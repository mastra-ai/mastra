# AGENTS.md

## Scope

This file applies to work in `packages/_types-builder/`.

## Overview

- `_types-builder` is internal build tooling for generated declaration output.
- It matters when package builds embed or rewrite types.

## Commands

### Build

- This package has no root build script.
- Validate changes through the directly affected consumer package build from the repository root.

### Test

- No package-local test script is defined.

### Typecheck

- No package-local typecheck script is defined.
- Validate changes through affected consumer builds.

### Lint and format

- No package-local lint script is defined.

## Working guidelines

- Keep changes focused on declaration generation, path rewriting, or packaging support.
- Avoid touching this package unless a consumer build clearly requires it.

## Verification

- Run the build for at least one directly affected consumer package.
- Verify generated declaration output when you change rewrite logic.

## Dependencies

- Consumer packages such as vendored and type-heavy internal packages rely on this tooling.

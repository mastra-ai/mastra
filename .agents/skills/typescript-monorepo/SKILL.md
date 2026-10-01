---
name: typescript-monorepo
description:
  Use when adding or changing packages/apps, TypeScript configs, workspace
  dependencies, package references, exports, or monorepo project-reference
  relationships.
---

# TypeScript Monorepo

## TypeScript

Use TypeScript everywhere practical. Compiler settings are intentionally fairly
strict.

- Shared compiler options live in `tsconfig.options.json`.
- Root `tsconfig.json` manages project references across the monorepo.
- Typechecking uses TypeScript 7's native `tsc` (the successor to the `tsgo`
  preview) and runs through moon: `moonx <project>:typecheck` (moon builds
  workspace dependencies first, since types resolve through each dependency's
  built dist). Next runs the same `tsc` for its build-time check through
  `experimental.useTypeScriptCli`, which is on by default since Next 16.3.

## Project References

When adding a new package or app:

- Add it to the root `tsconfig.json` references.
- Ensure its local `tsconfig.json` follows existing package/app patterns.
- Give it a `moon.yml` (language, layer, tags, and any project-specific tasks);
  shared tasks come from `.moon/tasks/*.yml` via tags or project language.

When one workspace package depends on another:

- Add the dependency as `workspace:*` in the consuming package.
- Add the dependency to the consuming package's TypeScript `references` block
  when needed for accurate and fast typechecking.

## Workspace Dependencies

Use the `pnpm-workspace.yaml` catalog rules from `tooling-and-dependencies` for
external packages. Use `workspace:*` for internal package dependencies.

If a package is published, review its `exports`, `typesVersions`, `files`, peer
dependencies, and its moon `prepublish` task chain before changing public
entrypoints or dependency ranges.

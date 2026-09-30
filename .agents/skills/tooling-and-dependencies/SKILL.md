---
name: tooling-and-dependencies
description:
  Use when running repo scripts, adding or changing dependencies, editing
  package.json files, installing packages, publishing packages, or deciding when
  pnpm package operations versus Bun runtime commands should be invoked.
---

# Tooling and Dependencies

## Toolchain (proto)

- Tool versions (bun, pnpm, node, moon, gh) are pinned in `.prototools` and
  managed by [proto](https://moonrepo.dev/docs/proto); its shims put the pinned
  versions on PATH inside the repo. `proto use` installs everything after a pin
  changes.
- Bump a tool by editing `.prototools` only — never install tools globally or
  pin versions elsewhere. moon's version is additionally enforced by
  `versionConstraint` in `.moon/workspace.yml` and mirrored as the
  `@moonrepo/cli` catalog entry (for Vercel builders without proto); keep all
  three in sync.
- CI and local shells resolve the same toolchain: CI installs it with
  `moonrepo/setup-toolchain`, which runs `proto install` against the same
  `.prototools`.

## Package Manager and Runtime

- Use `pnpm` for package operations: install, add, remove, dedupe, lockfile,
  package-runner, and publish work.
- Do not use `bun`, `npm`, `yarn`, `npx`, or other package runners for package
  operations unless there is a specific documented reason.
- Bun remains the direct TypeScript runtime and Bun test runner where current
  moon tasks use it. Local scripts may still be `.ts` files without a separate
  compile step.

## Dependency Catalog

This monorepo uses the `catalog` in `pnpm-workspace.yaml`.

- Never add a version directly to an individual package's `package.json` by
  default.
- To add a dependency:
  1. Add the exact version to `pnpm-workspace.yaml` under `catalog`, for example
     `"new-package": "1.2.3"`.
  2. Reference it from the package with `"new-package": "catalog:"`.
- Do not run `pnpm add <package>` inside a package directory; it writes direct
  versions and breaks the catalog pattern unless you manually normalize them.
- Published packages may intentionally use ranges for end-user compatibility.
  `apps/docs` should use catalog versions; published packages such as
  `packages/diffs` may use ranges only when that is intentional.

## Tasks

- All build/dev/test/lint entrypoints are moon tasks; package.json scripts exist
  only for npm lifecycle hooks (`prepublishOnly`). Never add task scripts back
  to a package.json.
- Tasks are defined in `.moon/tasks/*.yml` (inherited) and each project's
  `moon.yml`. Repo-wide tooling (format, lint, icons, clean) lives on the `root`
  project.
- Run tasks from anywhere in the repo:

```bash
moon run <project>:<task>
moonx <project>:<task>             # same engine; shorthand for moon exec
moonx <project>:<task> -- --flags  # forward arguments after --
moon run :test                     # a task across every project that has it
moon tasks <project>               # discover a project's tasks
```

`moon run` and `moonx` (an alias binary for `moon exec`) execute the same action
pipeline: identical dependency resolution, caching, and affected support. Use
them interchangeably; docs write `moon run` for canonical commands and `moonx`
in interactive examples. The one practical difference: `moonx`/`moon exec`
exposes CI-behavior overrides (`--ignore-ci-checks`, `--ci <bool>`) that
`moon run` lacks. `moon ci` is a third thing — the affected-aware orchestrator
used only by `.github/workflows/ci.yml`; never reach for it locally.

moon builds dependency projects first (`deps: ['^:build']`), caches outputs, and
skips tasks whose inputs have not changed. Local-only tasks set explicit options
instead of moon presets (presets force `runInCI: skip`, which moon refuses to
run in CI-detected shells; agent harnesses export `CI=1`):

- No graph edges at all (formatters, benchmarks, wt, servers spawned by
  playwright): use `runInCI: 'always'` — runnable everywhere, and never in the
  CI pipeline because a task with no deps or dependents is never affected
  through the graph.
- Connected to the build graph (dev/prod, e2e variants, publish guards): keep
  `runInCI: 'skip'` — `moon ci --include-relations` runs affected
  runInCI-enabled tasks even when unrequested, which would pull them into CI.
  Run them in CI-marked shells with `moonx <target> --ignore-ci-checks` (works
  regardless of the shell's CI env). For non-moon commands that CI-gate
  themselves, unset the var instead: `CI= pnpm publish --dry-run`.

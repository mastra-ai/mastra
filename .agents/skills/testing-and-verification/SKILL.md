---
name: testing-and-verification
description:
  Use when adding or running tests, checking snapshots, choosing between Bun
  tests and Playwright, running lint/format/typecheck, or deciding the
  verification scope for a change.
---

# Testing and Verification

## Baseline Commands

After code changes, run the required baseline (moon tasks run from anywhere in
the repo, including CI-marked agent shells):

```bash
moon run root:format root:lint
```

Useful check/fix pairs on the root project:

```bash
moon run root:format-check
moon run root:format
moon run root:lint
moon run root:lint-fix
moon run root:lint-css
moon run root:lint-css-fix
```

For code changes, also run the relevant typecheck (moon builds workspace
dependencies first automatically):

```bash
moonx <project>:typecheck
# or, scoped to what actually changed:
moonx :typecheck --affected
```

The React Compiler lint rules (`react/*` in `.oxlintrc.json`) assume React.
`packages/trees/src/render/**/*.tsx` and
`packages/trees/src/components/**/*.tsx` are Preact, so an `overrides` entry
there turns `react/refs` off for those globs. Put new Preact components under
those directories instead of adding per-file `oxlint-disable` headers.

## Unit and Integration Tests

Use Bun's built-in test runner. Tests usually live in a `test/` folder inside
each package and use `describe`, `test`, and `expect` from `bun:test`.

Prefer unit or integration tests by default:

```bash
moonx diffs:test
moonx trees:test
```

`moon run :test` runs every project's suite. Tests import workspace dependencies
through their built dist, so moon builds those first; running `bun test`
directly inside a package also works when dist is fresh.

## Snapshots

Bun supports `toMatchSnapshot()`. Avoid new snapshot coverage unless it is
shallow and narrowly scoped to the exact behavior under test.

Update snapshots from the package directory:

```bash
bun test -u
```

## Browser and E2E Tests

Add Playwright/browser E2E tests only when behavior cannot be validated without
a real browser engine. Good candidates include computed style checks, shadow DOM
boundaries, and browser-only rendering behavior.

Keep E2E coverage small and high-value:

```bash
moonx trees:coverage
moonx trees:test-e2e
moonx path-store:test-demo
moonx docs:test-e2e
```

If E2E fixtures or dev servers are started in a worktree, follow the cleanup
contract from the `worktrees-and-dev-servers` skill.

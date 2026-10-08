# GitHub Workflows

This directory contains GitHub Actions workflow files for the Mastra project.

## Affected test selection

Prebuild passes the complete PR file list to `scripts/affected-tests.mjs`. The selector follows imports and the explicit filesystem dependencies in `scripts/test-file-dependencies.cjs`. CSS, JSON, fixtures, and files outside `src/` must reach the selector, even when no TypeScript files changed.

When a test reads repository files or scans a directory instead of importing its inputs, register those inputs in `scripts/test-file-dependencies.cjs`. Use repository-relative file paths for exact matches and a trailing `/` for directory prefixes. Directory rules cover new, modified, and deleted files, including files with no importers. The initial rules cover Playground UI's filesystem checks, including its cross-package attachment-scheme check. Other file-reading tests need their own declarations; filesystem dependencies are not inferred automatically.

These edges participate in both file-level and symbol-aware selection. Changes to the registry select its existing tests, and deleted tests are not selected. The full-suite fallback still applies when more than half of all discovered tests are affected.

Prebuild runs the selector's regression tests before computing affected tests. They use temporary Git repositories and exercise the real selector and the workflow's compute step:

```sh
node --test .github/scripts/affected-tests.test.mjs
```

To reproduce selection locally, use `node scripts/affected-tests.mjs --git --json`, or pass `--changed-files <path>` with a newline-separated list of changed paths.

## Preventing Workflows from Running on Forks

To prevent workflows from running on forked repositories, we've added a condition to each workflow file that checks if the repository is the main Mastra repository:

```yaml
if: ${{ github.repository == 'mastra-ai/mastra' }}
```

If a job already has an `if` condition, we combine them:

```yaml
if: ${{ github.repository == 'mastra-ai/mastra' && (your existing condition) }}
```

## Benefits

- Prevents unnecessary workflow runs on forks
- Reduces notifications for fork owners
- Saves GitHub Actions minutes

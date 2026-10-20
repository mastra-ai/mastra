# PR risk classifier

Labels every PR on mastra-ai/mastra with exactly one of `risk: low`, `risk: medium` or `risk: high` and keeps one sticky comment explaining why. The workflow ships here as `pr-risk-classifier.workflow.yml`; a maintainer moves it to `.github/workflows/pr-risk-classifier.yml` (the Factory app cannot push workflow files).

How a PR is rated:

1. PRs that only touch docs, changesets or tests are `low` without a model call.
2. Otherwise the diff (runtime code first, lockfiles never, within a size budget) goes to the model with each file's package and how many in-repo packages depend on it. The model rates it against [`rubric.md`](./rubric.md).
3. CI workflows/actions, storage migrations and auth code are never rated below `medium`.

The comment notes when the PR's own `Risk:` line disagrees. If the model call fails, the label is left unchanged and the comment says so.

The workflow uses `pull_request_target`, checks out only base-branch files (this script and package manifests) and reads the diff through the API. PR code is never checked out or run.

Tune by editing `rubric.md`. The model defaults to `DEFAULT_MODEL` in `index.ts`; override with the `PR_RISK_MODEL` repository variable.

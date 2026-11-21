# PR risk classifier

Gives every PR on mastra-ai/mastra exactly one `risk: low`, `risk: medium` or `risk: high` label. The workflow ships here as `pr-risk-classifier.workflow.yml`; a maintainer moves it to `.github/workflows/pr-risk-classifier.yml` (the Factory app cannot push workflow files).

1. PRs that only touch docs, changesets or tests are `low` without a model call.
2. Otherwise TypeSafe's Jev picks low/medium/high from the diff (runtime code first, lockfiles never, within a size budget) and each file's package and in-repo dependent count. The rubric is the `INSTRUCTIONS` and `CRITERIA` text in `index.ts`; edit it to tune ratings.
3. If Jev's confidence is below `MIN_CONFIDENCE` (0.6), the PR gets `medium`.
4. CI workflows/actions, storage migrations and auth code are never rated below `medium`.

A missing `TYPESAFE_API_KEY`, an API error or an unusable answer leaves the current label unchanged. The model defaults to `jev-latest`; override with the `PR_RISK_MODEL` repository variable.

The workflow uses `pull_request_target`, checks out only base-branch files (this script and package manifests) and reads the diff through the API. PR code is never checked out or run.

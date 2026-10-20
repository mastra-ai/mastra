# PR risk classifier

Labels every PR on mastra-ai/mastra with exactly one of `risk: low`, `risk: medium` or `risk: high` and keeps one sticky comment explaining why. Runs from `.github/workflows/pr-risk-classifier.yml` (shipped here as `pr-risk-classifier.workflow.yml` until a maintainer moves it into place).

How a PR is rated:

1. **Deterministic pre-filter.** PRs that only touch docs, changesets or tests are `low` without a model call.
2. **Model verdict.** Otherwise the highest-signal diff hunks (runtime code in widely used packages first, lockfiles never) go to the model with per-file context: package, in-repo dependents, CODEOWNERS owners, file kind. The model rates the PR against [`rubric.md`](./rubric.md).
3. **Floors.** CI workflows/actions, storage migrations and auth code are never rated below `medium`, whatever the model says.

The PR's own `Risk:` line is shown next to the computed rating when they disagree. It does not influence the rating.

The workflow uses `pull_request_target`, checks out only base-branch files (this script, manifests, CODEOWNERS) and reads the diff through the API. PR code is never checked out or run. Unchanged PRs (same files, description Risk line, rubric and model) skip the model call. If the model fails, the label is left as it was and the comment says so.

## Tuning

Edit `rubric.md`. The model id defaults to `DEFAULT_MODEL` in `src/model.ts` and can be overridden with the `PR_RISK_MODEL` repository variable.

```sh
pnpm install --ignore-workspace
pnpm test                       # unit + pipeline tests, model calls through aimock
OPENROUTER_API_KEY=... pnpm eval:live   # real model against eval/fixtures
pnpm record-fixture 12345 high "why"    # add a past PR to the eval set
```

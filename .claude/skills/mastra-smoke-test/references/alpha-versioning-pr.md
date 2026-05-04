# Alpha Versioning PR Readiness

Use this only when the alpha versioning PR is still open.

## Open the PR for the user

Offer to open the open versioning PR in the user's browser when helpful:

```bash
gh pr view <pr-number> --web
```

Use `gh pr view --web` instead of browser automation because it opens the page in the user's normal browser/session.

## Check readiness

```bash
gh pr view <pr-number> --json number,title,isDraft,mergeable,reviewDecision,url
gh pr checks <pr-number> --watch=false
```

If checks are still running, wait:

```bash
gh pr checks <pr-number> --watch --interval 30
```

## Spot check the versioning diff

Before telling the user it is ready to merge, spot check the versioning diff yourself and advise the user to spot check it too. Prefer the helper script:

```bash
.claude/skills/mastra-smoke-test/scripts/check-versioning-pr.sh <pr-number> --workspace "$SMOKE_DIR"
```

Or inspect manually:

```bash
gh pr diff <pr-number> --name-only
gh pr view <pr-number> --json files --jq '.files[].path' \
  | rg '(package\.json|CHANGELOG\.md|\.changeset/)'
gh pr diff <pr-number>
```

Check:

- package versions look intentional
- there are no unintended major version bumps or breaking-change releases
- changelog entries match the PRs expected in the alpha
- CI is green and the PR is not a draft

Summarize your spot-check findings for the user before they approve/merge.

## Merge guidance

The user must review, approve, and merge the versioning PR. The agent may check readiness and advise, but should not merge the PR without explicit user instruction.

If the PR is ready, tell the user to approve and merge it in GitHub, or ask whether they want you to merge it. If branch protection rejects the merge because review is required, stop and ask for the required approval.

After the PR merges, continue with `references/alpha-publish.md`.

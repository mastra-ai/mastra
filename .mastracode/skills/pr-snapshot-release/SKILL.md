---
name: pr-snapshot-release
description: Guide a Mastra maintainer through publishing an npm snapshot from a pull request or a specified repository branch. Use when asked to release, publish, or create a PR snapshot, branch snapshot, canary package build, or branch-specific npm tag. Performs source and branch preflight checks, requires confirmation before the irreversible publish, dispatches the existing Publish to npm workflow, monitors it, and reports installable package tags.
---

# PR Snapshot Release

Publish a snapshot from a PR or a specified branch using `.github/workflows/npm-publish.yml`. Snapshot publishing is manual, works only for branches in `mastra-ai/mastra`, and publishes real immutable package versions to npm.

## 1. Resolve the source

Accept a PR number or URL, an explicit branch, or both. If neither is supplied, try the PR for the current branch:

```bash
pr=${PR_NUMBER_OR_URL:-$(gh pr view --json number --jq .number)}
gh pr view "$pr" \
  --json number,title,url,state,isDraft,baseRefName,headRefName,headRefOid,headRepository,mergeable,reviewDecision \
  --jq '{number,title,url,state,isDraft,baseRefName,headRefName,headRefOid,headRepository: .headRepository.nameWithOwner,mergeable,reviewDecision}'
```

When the user specifies a branch, publish that branch instead of assuming the PR head branch. If both are supplied and differ, call out the override clearly. When a PR is the source, stop if it is not open and record its `headRefName`, `headRefOid`, and head repository.

A workflow dispatch can only target a ref in `mastra-ai/mastra`. If a PR head is in a fork, explain that it cannot be published directly, but allow the user to specify an existing branch in `mastra-ai/mastra` instead. Do not push contributor code to an upstream branch without explicit maintainer direction.

## 2. Verify the exact branch revision

Resolve the selected branch to an exact SHA. For a PR branch, compare it with the inspected PR head SHA. For an explicitly specified branch, record the remote SHA as `head_sha`:

```bash
branch=<specifiedBranch-or-headRefName>
remote_sha=$(git ls-remote origin "refs/heads/$branch" | awk '{print $1}')
test -n "$remote_sha"
head_sha=${head_sha:-$remote_sha}
test "$remote_sha" = "$head_sha"
```

If it differs, refresh the source metadata and repeat the checks. Re-run this comparison immediately before dispatch. Never publish a stale or ambiguous revision.

When a PR is available, inspect `gh pr checks "$pr"` and mention any known failing checks in the confirmation summary. Do not block snapshot publishing on pending or failing checks. Call out when the PR is a draft.

## 3. Choose a custom npm tag

Always use a custom tag. If the user proactively supplied one, use it. Otherwise, derive a short, memorable lowercase kebab-case tag from the purpose of the PR or branch, such as `agent-builder` or `memory-fix`; do not ask the user to choose one. Tell the user which tag will be used. Avoid generic release tags such as `latest`, `next`, or `alpha`.

Check whether the tag already points to a published `@mastra/core` snapshot and call out that publishing will move it:

```bash
npm view @mastra/core "dist-tags.$tag"
```

Show the selected branch, SHA, PR URL when available, and custom tag before publishing. Do not imply that the workflow's `dry_run` input protects snapshots: the snapshot job does not honor it.

## 4. Confirm and dispatch

Publishing creates real npm versions and cannot be undone. Ask for explicit confirmation immediately before dispatch. Do not dispatch based only on the user's initial request.

```bash
gh workflow run npm-publish.yml \
  --repo mastra-ai/mastra \
  --ref "$branch" \
  -f publish_type=snapshot \
  -f tag="$tag"
```

## 5. Monitor the run

Find the newly dispatched run matching the branch and SHA, then verify its URL before watching it:

```bash
gh run list \
  --repo mastra-ai/mastra \
  --workflow npm-publish.yml \
  --branch "$branch" \
  --event workflow_dispatch \
  --limit 5 \
  --json databaseId,headSha,createdAt,status,conclusion,url \
  --jq ".[] | select(.headSha == \"$head_sha\")"

gh run watch <run-id> --repo mastra-ai/mastra --exit-status
```

If no matching run appears immediately, wait briefly and query again. Never select a run solely because it is the newest.

On failure, inspect the failed steps and report them without rerunning automatically:

```bash
gh run view <run-id> --repo mastra-ai/mastra --log-failed
```

A rerun publishes externally and requires fresh confirmation.

## 6. Verify and report

Determine which published packages are relevant to testing the PR or branch from its changed packages and the publish workflow output. Verify the custom tag for each relevant package. `@mastra/core`, `@mastra/observability`, and `@mastra/auth-studio` are forcibly included by the workflow, but only include them in the installation instructions when they are relevant:

```bash
npm view @mastra/core "dist-tags.$tag"
npm view <relevant-package> "dist-tags.$tag"
```

Report:

- PR URL when available and exact published commit SHA
- Workflow run URL and conclusion
- npm dist-tag
- Relevant package names and resolved versions
- A copy-pasteable, single-line pnpm command that installs every relevant package from the custom tag, for example:

```bash
pnpm add @mastra/core@agent-builder @mastra/server@agent-builder
```

Use the actual tag and package names in the command, not placeholders. Briefly state that the command should be run from the consuming project's root. Do not claim success or provide the install command until the workflow and every included npm tag lookup succeed.

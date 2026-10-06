---
name: playground-snapshot-release
description: Publish a Playground UI snapshot (`@mastra/playground-ui` and its workspace dependencies) from `main` or the current branch via the `playground-snapshot` mode of the Publish to npm workflow, wait for it to finish, then open a PR on `mastra-ai/platform` bumping the frontend to the published snapshot version. Use when asked to release, publish, or ship a playground/studio UI snapshot to the platform frontend.
---

# Playground Snapshot Release

Dispatches `.github/workflows/npm-publish.yml` with `publish_type=playground-snapshot`. That job publishes only `@mastra/playground-ui` and its non-private workspace dependencies (currently `@mastra/ai-sdk`, `@mastra/client-js`, `@mastra/core`, `@mastra/schema-compat`, `@mastra/react`) at version `0.0.0-<tag>-<timestamp>`. It refuses to run on `main`, and publishes real immutable npm versions.

## 1. Ask which branch

Use `ask_user` with exactly this single-select question:

> Sur quelle branche veux-tu exécuter le workflow ?

Options:

- `main` — publish from the latest `main` through a fresh branch
- `Branche courante (<current-branch>)` — publish from the current branch (show the real name from `git branch --show-current`)

## 2. Prepare the branch

### If `main`

The workflow rejects `refs/heads/main`, so publish from a new branch created from up-to-date `main`. Run from the repository root (`git rev-parse --show-toplevel`). Stop if the working tree is dirty (`git status --porcelain`) instead of stashing or discarding the user's work.

```bash
cd "$(git rev-parse --show-toplevel)"
git checkout main
git pull --ff-only origin main
branch="playground-snapshot/$(date +%Y%m%d-%H%M%S)"
git checkout -b "$branch"
git push -u origin "$branch"
```

### If current branch

```bash
branch=$(git branch --show-current)
```

Stop if `branch` is `main` or empty. Make sure the remote branch exists and contains the local commits: if `git status -sb` shows the branch ahead of or without an upstream, push it (`git push -u origin "$branch"`). Stop and ask if it has diverged from the remote.

### For both

Record the exact SHA that will be published:

```bash
head_sha=$(git ls-remote origin "refs/heads/$branch" | awk '{print $1}')
test -n "$head_sha"
```

## 3. Choose the tag

Derive a short lowercase kebab-case tag from the branch (the workflow default slugifies the branch name; passing it explicitly keeps it predictable). It must start with a letter and must not be `latest`, `next`, `alpha`, `beta`, `rc`, or `stable`. Tell the user which tag will be used.

## 4. Dispatch

The user picking a branch in step 1 is the confirmation to publish; do not ask again.

```bash
gh workflow run npm-publish.yml \
  --repo mastra-ai/mastra \
  --ref "$branch" \
  -f publish_type=playground-snapshot \
  -f tag="$tag"
```

## 5. Wait for completion

The run usually takes 5–10 minutes. Find the run matching the branch **and** SHA (never just the newest run); retry for a short while if it does not show up yet:

```bash
gh run list \
  --repo mastra-ai/mastra \
  --workflow npm-publish.yml \
  --branch "$branch" \
  --event workflow_dispatch \
  --limit 5 \
  --json databaseId,headSha,createdAt,status,conclusion,url \
  --jq ".[] | select(.headSha == \"$head_sha\")"
```

Watch it until it finishes. Tool calls time out, so run the watch in the background and poll, or use a long `timeout` (e.g. 1200 s):

```bash
gh run watch <run-id> --repo mastra-ai/mastra --exit-status --interval 30
```

On failure, report `gh run view <run-id> --repo mastra-ai/mastra --log-failed` and stop. Do not rerun automatically.

## 6. Resolve the published version

```bash
version=$(npm view @mastra/playground-ui "dist-tags.$tag")
```

All packages in the set share this version. Verify each package you are about to bump resolves to the same value with `npm view <pkg> "dist-tags.$tag"`. Do not continue if any lookup fails.

## 7. Open the platform PR

Work in a temporary clone of `mastra-ai/platform` (default branch `main`, pnpm workspace), never inside the mastra repo:

```bash
workdir=$(mktemp -d)
gh repo clone mastra-ai/platform "$workdir/platform" -- --depth 1
cd "$workdir/platform"
git checkout -b "chore/bump-playground-ui-$tag"
```

In `frontend/package.json`, set every `@mastra/*` dependency that belongs to the published set (`@mastra/playground-ui`, `@mastra/ai-sdk`, `@mastra/client-js`, `@mastra/core`, `@mastra/schema-compat`, `@mastra/react`) to the exact `$version`. Leave other `@mastra/*` packages (e.g. `@mastra/memory`) untouched, but mention in the PR body if they now differ from the bumped version, since they may need a full snapshot instead. Do not touch `admin-portal` unless the user asks.

Update the lockfile, then commit, push, and open the PR:

```bash
pnpm install --filter ./frontend --lockfile-only
git add frontend/package.json pnpm-lock.yaml
git commit -m "chore(frontend): bump playground UI to $version" \
  -m "Snapshot published from mastra-ai/mastra@$head_sha ($branch)." \
  -m "Co-Authored-By: mastracode <284800079+mastra-platform[bot]@users.noreply.github.com>"
git push -u origin HEAD
gh pr create --repo mastra-ai/platform --base main \
  --title "chore(frontend): bump playground UI to $version" \
  --body "<summary: source branch, SHA, workflow run URL, npm tag, bumped packages and version>"
```

If `pnpm install --lockfile-only` fails, report the error rather than committing an inconsistent lockfile.

## 8. Report

- Source branch and published SHA
- Workflow run URL and conclusion
- npm tag and version
- Bumped packages
- Platform PR URL

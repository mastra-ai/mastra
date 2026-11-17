---
name: playground-snapshot-release
description: Get a Playground UI snapshot (`@mastra/playground-ui`, `@mastra/observability`, `@mastra/mcp-apps-components`, and their workspace dependencies) of `main` or the current branch from the Playground UI snapshot workflow, which publishes to pkg.pr.new, then open a PR on `mastra-ai/platform` pinning the frontend to it. Use when asked to release, publish, or ship a playground/studio UI snapshot to the platform frontend.
---

# Playground Snapshot Release

`.github/workflows/playground-snapshot.yml` publishes `@mastra/playground-ui`, `@mastra/observability`, `@mastra/mcp-apps-components`, `@mastra/ai-sdk`, `@mastra/client-js`, `@mastra/react`, `@mastra/core` and `@mastra/schema-compat` to pkg.pr.new. It runs by itself on every push that changes `packages/playground-ui` or `packages/mcp-apps-components` (pull requests and `main`), and can be dispatched for any branch. Each package is installable at `https://pkg.pr.new/@mastra/<name>@<short sha>` as soon as the run finishes; nothing goes to npm.

pkg.pr.new deletes a build a month after its last download, and every build after six months. Rerun or dispatch the workflow on that commit to republish it.

## 1. Ask which branch

Use `ask_user` with exactly this single-select question:

> Which branch should the snapshot come from?

Options:

- `main` — the latest `main`
- `Current branch (<current-branch>)` — the current branch (show the real name from `git branch --show-current`)

## 2. Find the commit

### If `main`

```bash
git fetch origin main
branch=main
```

### If current branch

```bash
branch=$(git branch --show-current)
```

Stop if `branch` is empty. Make sure the remote branch exists and contains the local commits: if `git status -sb` shows the branch ahead of or without an upstream, push it (`git push -u origin "$branch"`). Stop and ask if it has diverged from the remote.

### For both

Record the exact SHA the snapshot is for:

```bash
head_sha=$(git ls-remote origin "refs/heads/$branch" | awk '{print $1}')
test -n "$head_sha"
short_sha=${head_sha:0:7}
```

## 3. Find or start the run

A push that changed the UI already started a run. Look for one on this exact SHA (never just the newest run); give it a minute to show up after a push:

```bash
gh run list \
  --repo mastra-ai/mastra \
  --workflow playground-snapshot.yml \
  --commit "$head_sha" \
  --limit 5 \
  --json databaseId,event,status,conclusion,url
```

If there's none (the commit didn't touch the UI, e.g. a `core`-only change Platform needs) or its build expired, dispatch one. The user picking a branch in step 1 is the confirmation; do not ask again.

```bash
gh workflow run playground-snapshot.yml --repo mastra-ai/mastra --ref "$branch"
```

Then find that run with the same `gh run list` command (`--event workflow_dispatch`).

## 4. Wait for completion

The run usually takes about 2 minutes:

```bash
gh run watch <run-id> --repo mastra-ai/mastra --exit-status --interval 15
```

On failure, report `gh run view <run-id> --repo mastra-ai/mastra --log-failed` and stop. Do not rerun automatically. If it failed with "app … is not installed", the pkg-pr-new GitHub App is missing from the repository.

## 5. Check the URLs

Each package is at `https://pkg.pr.new/@mastra/<name>@$short_sha`. Confirm the packages you'll pin respond before editing Platform:

```bash
for name in playground-ui core client-js react ai-sdk mcp-apps-components; do
  curl -fsSIL "https://pkg.pr.new/@mastra/$name@$short_sha" > /dev/null && echo "ok $name" || echo "missing $name"
done
```

Do not continue if any is missing.

## 6. Open the platform PR

Work in a temporary clone of `mastra-ai/platform` (default branch `main`, pnpm workspace), never inside the mastra repo:

```bash
workdir=$(mktemp -d)
gh repo clone mastra-ai/platform "$workdir/platform" -- --depth 1
cd "$workdir/platform"
git checkout -b "chore/bump-playground-ui-$short_sha"
```

In `frontend/package.json`, set **every** `@mastra/*` dependency that belongs to the published set (`@mastra/playground-ui`, `@mastra/observability`, `@mastra/mcp-apps-components`, `@mastra/ai-sdk`, `@mastra/client-js`, `@mastra/core`, `@mastra/schema-compat`, `@mastra/react`) to its URL, `https://pkg.pr.new/@mastra/<name>@$short_sha`. Pin all of them, not only Playground UI, so peer dependencies resolve to the same build. Leave other `@mastra/*` packages (e.g. `@mastra/memory`) untouched, but mention in the PR body if they now differ, since they may need a full snapshot instead. Do not touch `admin-portal` unless the user asks.

Update the lockfile, then commit, push, and open the PR:

```bash
pnpm install --filter ./frontend --lockfile-only
git add frontend/package.json pnpm-lock.yaml
git commit -m "chore(frontend): bump playground UI to $branch@$short_sha" \
  -m "Snapshot of mastra-ai/mastra@$head_sha ($branch) from pkg.pr.new." \
  -m "Co-Authored-By: mastracode <284800079+mastra-platform[bot]@users.noreply.github.com>"
git push -u origin HEAD
gh pr create --repo mastra-ai/platform --base main --head "$(git branch --show-current)" \
  --title "chore(frontend): bump playground UI to $branch@$short_sha" \
  --body "<summary: source branch, SHA, workflow run URL, pinned packages and URLs>"
```

If `pnpm install --lockfile-only` fails, report the error rather than committing an inconsistent lockfile.

## 7. Report

- Source branch and SHA
- Workflow run URL and conclusion
- Pinned packages and their URLs
- Platform PR URL

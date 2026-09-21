# Archaeology — command recipes

Zero judgment in this file. These are known-working command shapes; adapt them to the repository and preserve only decisive evidence in the review record.

**Shell notes.** `gh` output can carry ANSI codes that break `jq`; use `gh`'s built-in `--jq` or prefix with `NO_COLOR=1`. `timeout` is not a command on macOS. Quote paths with spaces.

## Resolve the PR before prediction

```bash
# Accepts a number, URL, or branch. Keep the first query minimal.
gh pr view <pr> --json number,title,body,author,baseRefName,url,linkedIssues \
  --jq '{number,title,author:.author.login,base:.baseRefName,url,issues:[.linkedIssues[]?.number],body}'
```

`baseRefName` is the comparison branch; it may not be `main`. Extract the problem statement from `body` and ignore implementation/change-list sections until after the pre-diff model is written.

Owner/repo for later calls:

```bash
gh repo view --json nameWithOwner --jq .nameWithOwner
```

## Open the PR after the pre-diff model

```bash
# Resolve the head now that isolation is over
gh pr view <pr> --json headRefName,headRefOid --jq '{head:.headRefName,headSha:.headRefOid}'

# Changed files
gh pr view <pr> --json files --jq '.files[] | "\(.path)\t+\(.additions) -\(.deletions)"'

# Commit list
gh pr view <pr> --json commits --jq '.commits[] | "\(.oid[0:8])  \(.messageHeadline)"'

# Reviews and review-thread comments (with resolved state)
gh api graphql -f query='
  query($owner:String!,$repo:String!,$pr:Int!){
    repository(owner:$owner,name:$repo){ pullRequest(number:$pr){
      reviews(first:50){ nodes{ author{login} state submittedAt body } }
      reviewThreads(first:100){ nodes{ isResolved isOutdated path line
        comments(first:20){ nodes{ author{login} createdAt body } } } }
    }}}' -F owner=<owner> -F repo=<repo> -F pr=<pr>

# PR-level (issue) comments
gh api repos/<owner>/<repo>/issues/<pr>/comments --jq '.[] | "\(.user.login) \(.created_at)\n\(.body)\n---"'

# CI status
gh pr checks <pr> 2>&1 || true
```

If GraphQL is rate-limited, the REST equivalents: `gh api repos/<owner>/<repo>/pulls/<pr>/files`, `.../pulls/<pr>/commits`, `.../pulls/<pr>/reviews`, `.../pulls/<pr>/comments` (review comments; no resolved state via REST — note that). Check quota with `gh api rate_limit --jq '.resources | {core:.core.remaining, graphql:.graphql.remaining}'`.

## Linked issues (step 2)

```bash
gh issue view <n> --json number,title,body,author,state,labels,comments \
  --jq '{number,title,author:.author.login,state,labels:[.labels[].name],body,comments:[.comments[] | {author:.author.login,body}]}'
```

Also scan the PR body for `#NNN`, `fixes`, `closes`, `resolves` — `linkedIssues` only catches the formally linked ones.

## Base-branch worktree before prediction

```bash
git fetch origin <base>
git worktree add /tmp/review-base-<pr> origin/<base>
```

A clean existing base checkout is also fine. Do not open the PR head until the pre-diff model is written.

## Head and diff after prediction

```bash
git fetch origin <head>
git worktree add /tmp/review-head-<pr> origin/<head>
git -C /tmp/review-head-<pr> diff origin/<base>...HEAD --stat
git -C /tmp/review-head-<pr> diff origin/<base>...HEAD
```

## History — when relevant

```bash
# Recent history of each core file (last 20 commits, not the whole log)
git log --oneline -20 origin/<base> -- <file>

# Who wrote the changed lines, in what commit (run on the base worktree against the pre-PR lines)
git blame -L <start>,<end> origin/<base> -- <file>

# From a blame SHA to its PR
gh pr list --search "<sha>" --state merged --json number,title,url --jq '.[]'
# or
gh api "repos/<owner>/<repo>/commits/<sha>/pulls" --jq '.[] | {number,title,html_url}'
```

Read the originating PR's description and review thread. That's where the reason lives.

## History — deep (on trigger)

```bash
# When was a string introduced or removed
git log -S "<exact string>" --oneline origin/<base> -- <path-or-dot>

# Reverts touching the area
git log --oneline origin/<base> --grep="^Revert" -- <path>

# The reverted attempt itself
gh pr view <n> --json title,body,reviews,comments

# Closed-unmerged PRs with the same idea (strongest precedent signal)
gh pr list --search "<feature terms> is:closed is:unmerged" --state closed --limit 20 --json number,title,closedAt,url --jq '.[]'

# Issues describing the same symptom under other words
gh issue list --search "<symptom terms>" --state all --limit 20 --json number,title,state,url --jq '.[]'
```

## Related PRs and issues (when overlap or precedent could matter)

```bash
# Open PRs touching the same files (merge-order risk)
gh pr list --state open --limit 50 --json number,title,files --jq '.[] | select(.files[].path | test("<path-fragment>")) | {number,title}'

# By feature/function name, open and closed
gh pr list --search "<term>" --state all --limit 20 --json number,title,state,url --jq '.[]'
gh issue list --search "<term>" --state all --limit 20 --json number,title,state,url --jq '.[]'
```

Search terms: the feature name, the file path, the function names touched, the error message from the issue.

## Callers

```bash
# Every reference to a changed symbol, on the PR branch
git grep -nE "\b<symbol>\b" -- '*.ts' '*.tsx' '*.js'

# Including string references (config keys, docs, dynamic imports)
git grep -n "<symbol>" -- ':!*.lock'

# Near-twin helper search: grep for the *verb* and the *shape*, not the name
git grep -nE "function (with|create|make)?[A-Za-z]*(Retry|retry)" -- 'packages/*.ts'
```

Every hit outside the PR's own changes is a caller to account for.

## Test on base — when needed

Use this only when code reasoning cannot establish whether the regression evidence would fail without the fix and the answer would materially affect confidence. Never replace production files in the current checkout with base versions. Use a disposable worktree; if it cannot be prepared cleanly, stop rather than falling back to modifying the live checkout.

```bash
ROOT=$(git rev-parse --show-toplevel)
MB=$(git merge-base origin/<base> origin/<head>)
WT="${TMPDIR:-/tmp}/review-tob-<pr>-$$"
test ! -e "$WT" || exit 1
git -C "$ROOT" worktree add "$WT" "$MB"
cd "$WT"

# Only the test files from the PR
git diff "$MB"...origin/<head> --name-only -- '**/*.test.*' '**/*.spec.*' '**/__tests__/**' > .test-files
git checkout origin/<head> -- $(cat .test-files)

# Build what the tests need, using the repo's documented shape (AGENTS.md / CONTRIBUTING). Do not improvise build commands.
# Inspect package.json scripts and lockfiles first; run everything with GH_TOKEN and GITHUB_TOKEN unset (the PR's code runs here).
# Then run only those files:
env -u GH_TOKEN -u GITHUB_TOKEN pnpm vitest run $(cat .test-files) --reporter=dot --bail 1 2>&1 | tail -40

cd "$ROOT"
git worktree remove --force "$WT"
```

Expected: red. Green means the test doesn't catch the regression — that's a finding, not a success. Record the decisive assertion, not the full output.

## Run the thing (public-api, behavior-change, docs)

A scratch project that consumes the package through its public export, not source imports. Build the package per the repo's documented command first (send build output to a separate log, not the transcript). This executes the PR's code: inspect its scripts and lockfile first and run with GH_TOKEN and GITHUB_TOKEN unset.

```bash
mkdir -p /tmp/review-run-<pr> && cd /tmp/review-run-<pr>
# link or install the workspace package, write a 10-line script that exercises the claim, run it
env -u GH_TOKEN -u GITHUB_TOKEN node demo.mjs 2>&1 | tee /tmp/review-run-<pr>/with.txt
```

For behavior changes, run the same script against a base build into `without.txt`. Summarize the observed difference in the review record; retain transcripts only when they help reproduce it.

## Changeset

```bash
git diff origin/<base>...HEAD --name-only -- .changeset/
cat .changeset/*.md   # on the branch; read the level and the packages
```

## CODEOWNERS / who likely knows

```bash
# Owners for the touched paths
grep -n "<path-fragment>" .github/CODEOWNERS 2>/dev/null
# Or the people who've touched the file most recently
git shortlog -sn --since="1 year ago" origin/<base> -- <file> | head -5
```

Name a person under **Open questions**, not "someone."

## Long memory — recovery searches

| Memory      | What the reviewer "just knows"                      | Recover from                                                                                                        |
| ----------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Decisions   | "We chose X over Y because…"                        | Originating PRs (blame → PR), nearest AGENTS.md, design docs, `git grep -nE "because                                | workaround | don't  | see #" -- <files>` near the changed lines                             |
| Scars       | "Last time someone touched this it broke Z"         | `git log --grep="^Revert" -- <path>`; test names that encode bugs (`git grep -nE "should not                        | regression | double | race" -- <test files>`); `gh issue list --search "<area> regression"` |
| Users       | "Half the community calls this with a string"       | `git grep -n "<api>" -- examples/ docs/`; `gh issue list --search "<api>"`; call sites in the repo                  |
| Conventions | "We always go through the storage abstraction here" | The sibling feature; the three closest public neighbors; the package `CHANGELOG.md` for recent movement in the area |

## Cleanup

```bash
git worktree remove --force /tmp/review-base-<pr> 2>/dev/null
git worktree remove --force /tmp/review-head-<pr> 2>/dev/null
```

Leave the handoff artifact in place so a re-review can reuse the recorded design and earlier findings.

# Recipes

Zero judgment in this file. Known-working command shapes; adapt them to the repository and preserve only decisive evidence in the record.

**Shell notes.** `gh` output can carry ANSI codes that break `jq`; use `gh`'s built-in `--jq` or prefix with `NO_COLOR=1`. `timeout` is not a command on macOS. Use `git grep`, not `rg`. Quote paths with spaces.

## Resolve the issue

Body plus counts only—this tells you whether there is anything to seal.

```bash
gh issue view <n> --json number,title,body,state,labels,url,createdAt,comments \
  --jq '{number,title,state,labels:[.labels[].name],url,createdAt,commentCount:(.comments|length),body}'

# Linked PR count without reading them
gh api repos/<owner>/<repo>/issues/<n>/timeline --paginate \
  --jq '[.[] | select(.event=="cross-referenced" and .source.issue.pull_request != null)] | length'

# From a branch name
m=$(git branch --show-current | grep -oE '(fix|issue|gh)-[0-9]+'); [ "$(printf '%s\n' "$m" | grep -c .)" -eq 1 ] || { echo "ambiguous or missing issue number — resolve manually" >&2; exit 1; }; printf '%s\n' "$m"
```

## Open the thread (after the own model, if the thread is non-empty)

```bash
# Comments in order
gh issue view <n> --json comments --jq '.comments[] | "\(.author.login) \(.createdAt)\n\(.body)\n---"'

# Cross-references (linked PRs, mentions) via timeline
gh api repos/<owner>/<repo>/issues/<n>/timeline --paginate \
  --jq '.[] | select(.event=="cross-referenced") | .source.issue | "\(.number) \(.title) \(.state) \(.pull_request != null)"'

# Same symptom under other words, open and closed
gh issue list --search "<symptom terms>" --state all --limit 20 --json number,title,state,url --jq '.[]'
gh pr list --search "<symptom terms>" --state all --limit 20 --json number,title,state,url --jq '.[]'

# In-flight fix attempts
gh pr list --search "<n> in:body" --state all --json number,title,state,url --jq '.[]'
```

Author context, when it changes where you look first:

```bash
gh pr list --author <user> --state merged --limit 100 --json number --jq length
```

If GraphQL is rate-limited: `gh api repos/<owner>/<repo>/issues/<n>` and `.../issues/<n>/comments`. Check quota with `gh api rate_limit --jq '.resources | {core:.core.remaining, graphql:.graphql.remaining}'`.

## Trace from the symptom

```bash
# Error text or user-facing string
git grep -n "<exact error fragment>" -- ':!**/*.test.*' ':!**/dist/**'

# Callers of the suspect function
git grep -n "<functionName>(" -- '*.ts' ':!**/*.test.*'

# Where a config key or option is read
git grep -nwE "<optionName>" -- '*.ts' ':!**/*.test.*'   # POSIX ERE has no \b; -w gives the word boundary
```

## History

```bash
# Who last changed the suspect lines and why
git blame -L <start>,<end> -- <file>
git show --stat <sha>

# When a condition or string entered or left
git log -S"<fragment>" --oneline -- <path>

# Recent movement in the area
git log --oneline -20 -- <path>

# Reverts and scars
git log --grep="^Revert" --oneline -- <path>
git grep -nE "because|workaround|don't|see #" -- <files>

# Originating PR for a commit
gh pr list --search "<sha>" --state merged --json number,title,url --jq '.[]'
```

## Regression

```bash
# Confirm the last known-good behavior at a tag or sha in a disposable worktree
git worktree add /tmp/issue-<n>-base <sha-or-tag>
# ... run the probe there ...
git worktree remove /tmp/issue-<n>-base --force

# Bisect only when reasoning cannot settle it
git bisect start <bad> <good>
git bisect run <probe command>
git bisect reset
```

## Probe

Keep probes minimal and remove them. Prefer a throwaway test file alongside the suspect module in a disposable worktree, or a short script that imports the built package. Record the command and the decisive line of output in the record, not the transcript.

## Posting (only with explicit user approval)

Voice and post commands live in the `gh-review` skill — load it before drafting. Write the body to a file first.

```bash
# Edit a posted issue comment
body=$(jq -Rs . /tmp/issue-comment.md)
gh api repos/<owner>/<repo>/issues/comments/<comment_id> -X PATCH -H 'Content-Type: application/json' --input - <<EOF
{"body":$body}
EOF
```

# Bulk Issue Solver

Orchestrate parallel `mc` (mastracode) headless instances to debug and fix multiple GitHub issues simultaneously. You act as the supervisor — spawning workers, monitoring progress, reviewing output, and creating PRs.

## Inputs

$ARGUMENTS should be a space-separated list of GitHub issue numbers, e.g. `1234 5678 9012`.

If no arguments are provided, use the GH CLI and the user's contribution history to recommend issues:

RUN gh issue list --state open --limit 50 --json number,title,labels,assignees
RUN git log --author="$(git config user.name)" --pretty=format:'' --name-only --since="6 months ago" | sed 's|/[^/]*$||' | sort | uniq -c | sort -rn | head -20

Summarize the user's contribution areas and match them to open issues. Ask the user which issues to work on before proceeding.

## Setup

For each issue number in the list:

1. **Create a git worktree** with a dedicated branch:

   ```
   git worktree add ../$(basename $PWD)-issue-<NUMBER> -b fix/issue-<NUMBER>
   ```

2. **Install and build** in the worktree. Run 2 worktrees at a time to manage CPU:

   ```
   cd ../$(basename $PWD)-issue-<NUMBER> && pnpm i && pnpm build
   ```

3. **Spawn an `mc` headless instance** in each worktree with a generous timeout (30 minutes):
   ```
   cd ../$(basename $PWD)-issue-<NUMBER> && pnpx tsx <path-to-mastracode>/src/main.ts --timeout 1800 --prompt "/gh-debug-issue <NUMBER>"
   ```
   Run all instances as background processes with a matching `timeout` on `execute_command`. Track each PID.

## Monitoring

Create a `reports/` directory in the main project root. For each issue, maintain a `reports/issue-<NUMBER>.md` file with:

- Issue number, title, and link
- Current status (Analyzing / Implementing / Tests passing / PR open / Done)
- Summary of the approach and changes
- PR URL once created
- Any blockers or notes

**Check all processes every 3 minutes.** For each check:

1. Read the tail output of every running PID
2. Update the corresponding report file
3. Report a brief status table to the user

## When an `mc` instance finishes or times out

1. Check `git diff --stat` in the worktree to see what changed
2. Check for new changesets and ISSUE_SUMMARY files
3. If the instance **timed out but made progress**, restart it with a `--prompt` that says "Continue working on issue #<NUMBER>." and summarizes where it left off based on the diff and last output
4. If the instance **completed its work** (code + tests + changeset):
   - Review the diff — does the fix make sense?
   - Report the changes to the user for review
   - When approved, commit, push, and create a PR using `/gh-new-pr` conventions:
     - Conventional commit title: `fix: ...` or `feat(pkg): ...`
     - Concise PR description with code examples
     - Reference `Closes #<NUMBER>`
   - Update the report file with the PR URL

## PR Review Comments

After PRs are created, spawn `mc` instances with `/gh-pr-comments <PR_NUMBER>` to handle CodeRabbit and reviewer feedback. If an instance times out, restart it with context about which comments still need addressing.

## CI Checks

After pushing a PR (and after each subsequent push from comment fixes), check CI status:

```
gh pr checks <PR_NUMBER>
```

If any checks are failing, spawn an `mc` instance in the worktree with `/gh-fix-ci` to diagnose and fix the failures. If it times out, restart it with context about which checks failed and what was already attempted.

## Key Rules

- **2 builds at a time** to manage CPU during `pnpm build`
- **All `mc` instances can run in parallel** — they're IO-bound, not CPU-bound
- **One worktree per issue, always** — every task related to an issue (debugging, PR comments, CI fixes) must run in that issue's worktree. Never create a second worktree for the same issue. The worktree accumulates context (commits, diffs, build artifacts) that each `mc` instance benefits from.
- **Always restart timed-out processes** with a continuation prompt that includes context from the diff and last output
- **Never leave a process unmonitored** — check every 3 minutes
- **Update report files continuously** so the user always has a written record
- **Review all `mc` output before creating PRs** — subagent work is untrusted

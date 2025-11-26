# Backport PR

Backport a PR from main (beta) branch to the current branch (typically 0.x stable).

## Arguments

- `$ARGUMENTS` - GitHub PR URL or PR number to backport (e.g., `https://github.com/mastra-ai/mastra/pull/10206` or `10206`)

## Instructions

### 1. Get PR Details

First, fetch the PR details to understand what's being backported:

```
gh pr view <PR_NUMBER> --repo mastra-ai/mastra --json title,body,mergeCommit,state,commits
```

### 2. Verify Current Branch State

Ensure you're on a clean branch:

```
git status
```

The branch should be clean with no uncommitted changes.

### 3. Attempt Cherry-Pick

Try to cherry-pick the merge commit:

```
git cherry-pick <MERGE_COMMIT_SHA> --no-commit
```

### 4. Handle Conflicts

If there are conflicts:

1. List conflicted files: `git diff --name-only --diff-filter=U`
2. For each conflicted file, read it and resolve conflicts by:
   - Understanding what the PR is trying to accomplish
   - Keeping the 0.x branch patterns
   - Merging in the new functionality from the PR
3. For auto-generated files (docs, types, registry files), accept "theirs" version: `git checkout --theirs <file>`
4. Stage resolved files: `git add <file>`

### 5. Understanding Branch Differences

**Common differences** (main/beta uses left, 0.x uses right):

- `RequestContext` → `RuntimeContext`

**For other API differences**, consult the v1 migration guide:

- **Overview**: https://mastra.ai/guides/v1/migrations/upgrade-to-v1/overview
- **Specific topics**: https://mastra.ai/guides/v1/migrations/upgrade-to-v1/{topic}
  - Topics: agents, cli, client-sdk, evals, mastra, mcp, memory, processors, storage, tools, tracing, vectors, voice, workflows

Use WebFetch to read relevant migration pages when you encounter unfamiliar API changes.

### 6. Build and Test

After resolving conflicts:

1. Build the affected package(s)
2. Run relevant tests to verify the backport works
3. Fix any remaining issues

### 8. Final Status

Show the final git status with all staged changes and provide a summary of:

- What was backported
- Any conflicts that were resolved
- Any adaptations made for 0.x compatibility
- Test results

## Notes

- Do NOT commit automatically - let the user review and commit
- If the PR depends on other PRs not yet backported, inform the user
- If the changes are too divergent to backport cleanly, explain the issues and ask for guidance

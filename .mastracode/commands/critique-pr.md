---
name: critique-pr
description: Analyze, critique, summarize, and draft an optional review comment for the current pull request
goal: true
---

# Review Pull Request

Use the GH CLI to analyze and summarize a pull request for the current repository.
The current branch should be checked out in the same branch as the PR but you will need to verify that first.

RUN gh pr view --json title,body,commits,files,labels,assignees,reviews,comments,statusCheckRollup

## Review Process

### Stage 1: Understand the Context

Use `.mastracode/shared/pr-review-context.md` for the context-gathering portion of this review. Keep this command responsible for the critique, summary artifact, optional review draft, and posting flow.

### Stage 2: Analyze the Code

1. Create a .pr-review/PR_SUMMARY.md file with sections for:
   - **Overview**: What this PR accomplishes
   - **How It Works**: Technical explanation of the implementation
   - **Key Changes**: File-by-file breakdown with links (use format: `path/to/file.ts:line`)
   - **Architecture Impact**: How this fits into the overall system
   - **Dependencies**: Any new dependencies or APIs introduced
   - **Testing**: What tests cover these changes, what validation you ran, and whether dependencies were installed and affected packages were built first
   - **Potential Concerns**: Confirmed issues, speculative risks, or areas that need attention

2. Before running tests, check whether dependencies are installed. If dependencies are missing, stale, or package manifests / lockfiles changed, run the project install command first. For this repo, prefer `pnpm i` unless local instructions say otherwise.
3. Build affected packages before relying on tests that consume their compiled outputs. Prefer narrow package/workspace build commands over repo-wide builds.
4. Do not claim a test, build, or check passed unless you ran it or verified the matching CI check.
5. For each significant file change:
   - Understand the context and purpose
   - Explain the logic flow and implementation details
   - Note how it connects to other parts of the codebase
   - Identify any patterns or conventions used
   - Link to specific lines for important code sections only after confirming the line numbers

### Stage 3: Deep Dive

1. Trace through the code execution path
2. Understand the data flow and transformations
3. Check how edge cases are handled
4. Verify integration points with existing code
5. After reviewing the code, verify the PR title and description match the actual diff; call out mismatches
6. Check whether the changes require a changeset, docs updates, package-local AGENTS.md instructions, or other repository PR requirements, and call out any missing required items
7. Document your understanding in the summary file

### Stage 4: Present to User

1. Complete .pr-review/PR_SUMMARY.md with a comprehensive explanation
2. Use clear, technical language to explain how the code works
3. Include helpful diagrams or examples if complex logic is involved
4. Link to specific files and line numbers for easy navigation
5. Highlight any interesting design decisions or trade-offs
6. Draft a PR review comment for the user. Include the full text of the drafted comment directly in your message to the user — do not just reference the `.pr-review/PR_SUMMARY.md` file path. Ask what changes they want, and make clear that posting it is optional. Do not post it unless the user explicitly asks you to post the current draft.

## Summary Structure Example

```markdown
# PR Summary: [PR Title]

## Overview

Brief description of what this PR achieves and why it's needed.

## How It Works

Technical explanation of the solution approach and implementation strategy.

## Key Changes

### Modified Files

- `src/services/auth.ts:45-67` - Added new authentication middleware
- `src/utils/validation.ts:12-34` - Enhanced input validation logic
- `tests/auth.test.ts:89-120` - New test cases for auth flow

### New Files

- `src/middleware/rateLimit.ts` - Implements rate limiting functionality

## Architecture Impact

How these changes fit into and affect the overall system architecture.

## Dependencies

- Added `express-rate-limit` for rate limiting
- Updated `jsonwebtoken` to v9.0.0

## Testing

- Ran `pnpm i` because the lockfile changed
- Built affected package with `pnpm --filter ./packages/auth build`
- Unit tests in `tests/auth.test.ts`
- Integration tests in `tests/integration/auth.spec.ts`
- All existing tests still pass

## Potential Concerns

- Confirmed issue: old tokens fail immediately after deploy
- Speculative risk: performance impact of additional middleware
```

After you've finished and written the .md file, give the user a TLDR containing the most important points. After the TLDR explain concisely your main concerns, and just note that you don't have any concerns if you don't. Then present the full text of the drafted PR review comment directly in your message — do not tell the user to go read the `.pr-review/PR_SUMMARY.md` file.

## Posting a PR Review Comment (Optional)

Draft a PR review comment proactively, but the user decides whether it gets posted. Always include the full draft text directly in your message to the user so they can read and evaluate it without opening any files. Ask what changes the user wants to the draft, whether they want to post it, or whether they do not want to post anything. If the user asks for changes, re-draft the full comment, present the updated text directly, and ask again. Do not post unless the user explicitly asks you to post the current draft.

If the user decides to post the review comment, first align on the contents of the review comment, then follow this guidance for posting:

GitHub has separate rate-limit buckets for GraphQL and REST. Some `gh pr` commands use GraphQL, so they can fail with a GraphQL rate-limit error even when REST API calls still have quota. When that happens, use the REST issues comments API instead:

```bash
# Write the intended comment body to a file first.
cat > /tmp/pr-comment.md <<'EOF'
Comment body here.
EOF

# Post a PR-level comment via REST. PRs are issues for this endpoint.
body=$(jq -Rs . /tmp/pr-comment.md)
gh api repos/:owner/:repo/issues/<PR_NUMBER>/comments \
  -X POST \
  -H 'Content-Type: application/json' \
  --input - <<EOF
{"body":$body}
EOF
```

If the wrong body is posted, patch the comment with REST:

```bash
body=$(jq -Rs . /tmp/pr-comment.md)
gh api repos/:owner/:repo/issues/comments/<COMMENT_ID> \
  -X PATCH \
  -H 'Content-Type: application/json' \
  --input - <<EOF
{"body":$body}
EOF
```

Use `gh api rate_limit --jq '.rate'` to check REST quota.

# Review Pull Request

Use the GH CLI to analyze and summarize a pull request for the current repository.
The current branch should be checked out in the same branch as the PR but you will need to verify that first.

RUN gh pr view --json title,body,commits,files,labels,assignees,reviews,comments,checksStatus

## Review Process

### Stage 1: Understand the Context

1. Read the PR title and description carefully
2. Check linked issues (if any) using `gh issue view`
3. Review the commit history to understand the progression of changes
4. Note any labels, assignees, and check status

### Stage 2: Analyze the Code

1. List all changed files using `gh pr diff`
2. Create a PR_SUMMARY.md file in the project root with sections for:
   - **Overview**: What this PR accomplishes
   - **How It Works**: Technical explanation of the implementation
   - **Key Changes**: File-by-file breakdown with links (use format: `path/to/file.ts:line`)
   - **Architecture Impact**: How this fits into the overall system
   - **Dependencies**: Any new dependencies or APIs introduced
   - **Testing**: What tests cover these changes
   - **Potential Concerns**: Any risks or areas that need attention

3. For each significant file change:
   - Understand the context and purpose
   - Explain the logic flow and implementation details
   - Note how it connects to other parts of the codebase
   - Identify any patterns or conventions used
   - Link to specific lines for important code sections

### Stage 3: Deep Dive

1. Trace through the code execution path
2. Understand the data flow and transformations
3. Check how edge cases are handled
4. Verify integration points with existing code
5. Document your understanding in the summary file

### Stage 4: Present to User

1. Complete the PR_SUMMARY.md with a comprehensive explanation
2. Use clear, technical language to explain how the code works
3. Include helpful diagrams or examples if complex logic is involved
4. Link to specific files and line numbers for easy navigation
5. Highlight any interesting design decisions or trade-offs

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

- Unit tests in `tests/auth.test.ts`
- Integration tests in `tests/integration/auth.spec.ts`
- All existing tests still pass

## Potential Concerns

- Performance impact of additional middleware
- Migration needed for existing tokens
```

After you've finished and written the .md file, give the user a TLDR containing the most important points. After the TLDR explain concisely your main concerns, and just note that you don't have any concerns if you don't.

## Posting a PR Review Comment (Optional)

Offer to post a PR review comment if the user wants one. First align on the contents of the review comment, then follow this guidance for posting:

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

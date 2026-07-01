# PR review context

Use this shared context-gathering checklist when a command needs code-accurate PR review context. This file only gathers evidence; the calling command owns critique decisions, comments, routing, severity, and user interaction.

## Inputs

- PR number or URL.
- Optional issue context or shared triage file.

## Context to gather

1. Verify the current repository and target PR.
2. Fetch PR metadata, description, commits, files, labels, assignees, reviews, comments, and checks.

```bash
gh pr view <PR> --json title,body,commits,files,labels,assignees,reviews,comments,statusCheckRollup,closingIssuesReferences,mergeStateStatus,isDraft,state,author,url
```

3. Inspect PR comments and review threads, including automated reviewer comments such as CodeRabbit. Record only comments that affect review context, existing requested changes, or maintainer attention.
4. If linked or closing issues exist, fetch the issue details and comments.

```bash
gh issue view <ISSUE> --comments --json number,title,state,author,labels,assignees,body,comments,url
```

5. Review commit history to understand the progression of changes.
6. Inspect changed files before reading full diffs.

```bash
gh pr diff <PR> --name-only
gh pr diff <PR>
```

7. For each significant file change:
   - Understand the surrounding code and purpose.
   - Trace the relevant logic flow and data transformations.
   - Check integration points with existing code.
   - Note patterns, conventions, tests, docs, changesets, package-local instructions, or dependency/build requirements.
   - Confirm line numbers before citing `path:line` evidence.
8. Compare the PR title and description against the actual diff; record mismatches.
9. Check status checks, but ignore Vercel CI failures unless directly relevant to the issue, PR, or deployment behavior.
10. Before relying on tests, builds, or checks, verify they were actually run or are present in CI. Do not claim they passed from expectation alone.

## Return only context

Return concise context for the calling command:

- PR summary.
- Linked issue summary, if any.
- Changed files and affected areas.
- Evidence checked, including important PR comments/review threads and `path:line` references.
- Test/build/check status that was actually verified.
- Context gaps or uncertainty.

Do not decide final maintainer action, post comments, assign severity, route triage branches, or create files from this shared checklist.

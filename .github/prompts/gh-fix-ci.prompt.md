---
mode: agent
description: Use the GH CLI to fix CI failures on a pull request
---

# Fix GitHub Actions CI Failures

Diagnose and fix GitHub Actions CI failures for the current branch's associated pull request.

First, identify the PR and check CI status:
RUN GH_PAGER=cat gh pr status
RUN GH_PAGER=cat gh pr checks

Think deeply about the failures:

1. Analyze error messages and failing test output
2. Identify patterns across multiple failures
3. Determine if failures are flaky tests, actual bugs, or environment issues
4. Create a systematic plan to address each failure type

Then implement fixes:

- Make necessary code changes to fix failing tests or CI issues
- Run tests locally if possible to verify fixes
- Commit all changes with a clear message explaining the CI fixes

Finally, verify the fix:

- Push changes and monitor the new CI run
- Confirm all checks are passing

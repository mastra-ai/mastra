---
name: factory-complete-issue
description: Remove Factory triage labels when a GitHub issue is moved to Done
---

# Factory Complete Issue

Clean up the GitHub issue behind a Factory work item that was moved to Done.

Parse the issue URL or number from `$ARGUMENTS`, then read its current labels. Remove any of these labels that are present:

- `status: needs triage`
- `status: auto-triaged`
- `status: needs approval`

Use `gh issue edit <issue> --remove-label <label>` for each present label. Do not add or remove any other labels. Do not comment, close, reopen, assign, or edit the issue, and do not request another Factory transition.

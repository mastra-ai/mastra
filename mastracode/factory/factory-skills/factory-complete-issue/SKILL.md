---
name: factory-complete-issue
description: Mark a GitHub issue as done and update its status labels
---

# Factory Complete Issue

Mark the GitHub issue behind a completed Factory work item as done and update its status labels.

Parse the issue URL or number from `$ARGUMENTS`, then read its current state and labels. Remove any of these labels that are present:

- `status: needs triage`
- `status: auto-triaged`
- `status: needs approval`

Use `gh issue edit` to remove the listed triage labels and, if the issue is open, add `status: pending-close` when it is not already present. Do not add `status: pending-close` if the issue is already closed, and do not modify any other labels or issue fields. Then post this comment unless the issue already has it:

> This issue has now been marked as done.

Do not close, reopen, or assign the issue, and do not request another Factory transition.

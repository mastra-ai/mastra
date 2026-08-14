---
name: factory-complete-issue
description: Mark a GitHub issue as done and update its status labels
---

# Factory Complete Issue

Mark the GitHub issue behind a completed Factory work item as done and update its status labels.

Parse the issue URL or number from `$ARGUMENTS`, then read its current labels. Remove any of these labels that are present:

- `status: needs triage`
- `status: auto-triaged`
- `status: needs approval`

Use `gh issue edit <issue> --remove-label <label>` for each present label, then add `status: pending-close` if it is not already present. Then post this comment unless the issue already has it:

> This issue has now been marked as done.

Do not add or remove any other labels, close, reopen, assign, or edit the issue, and do not request another Factory transition.

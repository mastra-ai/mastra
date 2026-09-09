---
name: factory-complete-issue
description: Mark the issue behind a completed Factory work item as done and update its status labels
---

# Factory Complete Issue

Mark the issue behind a completed Factory work item as done. `$ARGUMENTS` names the issue; it may be a GitHub issue number or URL, a GitLab reference (`<project>!<iid>`, `<group>/<project>#<iid>`, or an issue URL), or a Linear identifier. Follow the branch for the provider it names and do not attempt another provider's commands — `gh` cannot read or edit a GitLab or Linear issue.

## GitHub issues

Parse the issue URL or number from `$ARGUMENTS`, then read its current state and labels. Remove any of these labels that are present:

- `status: needs triage`
- `status: auto-triaged`
- `status: needs approval`

Use `gh issue edit` to remove the listed triage labels. If the issue is open, add `status: pending-close` when it is not already present and post this comment unless the issue already has it:

> This issue has now been marked as done.

If the issue is already closed, do not add `status: pending-close` or post the comment. Do not modify any other labels or issue fields.

## GitLab issues

Read the issue with `gitlab_get_issue`. If it is open, post the same comment with `gitlab_create_comment` unless a note with that text is already there:

> This issue has now been marked as done.

If the issue is already closed, post nothing. GitLab intake carries no `status:` labels, so there are none to remove and none to add — leave the issue's labels untouched.

## Linear issues

Read the issue with `linear_get_issue`. If it is not already in a completed or canceled state, post the same comment with `linear_create_comment` unless it is already present. Leave the issue's state and labels untouched.

## All providers

Do not close, reopen, or assign the issue, and do not request another Factory transition.

---
name: factory-complete-issue
description: Mark a GitHub issue as done and update its status labels
---

# Factory Complete Issue

Mark the GitHub issue behind a completed Factory work item as done and update its status labels.

Parse the issue URL or number from `$ARGUMENTS` first. The Factory system prompt identifies the **Target repository**. Before reading or changing issue state, verify the checkout with `git rev-parse --show-toplevel` and `git remote get-url origin`. Normalize SSH and HTTPS GitHub remotes to `owner/repository` (ignoring a trailing `.git`) and require the checkout remote to match the target exactly. If `$ARGUMENTS` contains a GitHub issue URL, extract its `owner/repository` and require it to match both the target and the checkout remote exactly. Never use a URL's repository to override the target. If only an issue number is supplied, resolve it explicitly in the target repository (for example, with `gh issue view <number> --repo <owner/repository>`), not from the current gh default. If any identity is missing or mismatched, stop without modifying the issue and report the issue URL or number, expected target, observed remote/root, and mismatch.

Once identities match, read the issue's current state and labels. Remove any of these labels that are present:

- `status: needs triage`
- `status: auto-triaged`
- `status: needs approval`

Use `gh issue edit --repo <owner/repository>` to remove the listed triage labels. If the issue is open, add `status: pending-close` when it is not already present and post this comment unless the issue already has it. Pass `--repo <owner/repository>` to every `gh issue` read or mutation:

> This issue has now been marked as done.

If the issue is already closed, do not add `status: pending-close` or post the comment. Do not modify any other labels or issue fields.

Do not close, reopen, or assign the issue, and do not request another Factory transition.

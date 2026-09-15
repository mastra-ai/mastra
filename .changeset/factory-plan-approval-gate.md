---
'@mastra/factory': patch
---

Fixed Factory plan handoffs when Auto-approve plans is off.

Plan agents now leave work items in Planning until a maintainer approves the plan. Factory does not queue a build before that approval.

Preapproved plans and projects with Auto-approve plans enabled continue to advance automatically. Arming an autonomous run does not approve a plan.

Fixes #23742.

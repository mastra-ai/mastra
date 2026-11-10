---
'@mastra/factory': patch
---

`source_control_push_branch` now accepts an optional `workItem` (id or `#number`) so a session can push a fix to the existing branch of a work item it follows or is bound to, such as that item's pull request branch. Factory works out the branch name itself and only fast-forwards it. If the remote branch has commits the checkout lacks, the push is refused.

---
"@mastra/core": patch
---

Fixed skill tools (`skill`, `skill_read`, `skill_search`) pausing for approval when `requireToolApproval` is enabled globally. Previously every skill load in an approval-enabled agent (including durable agents) suspended for an approval nobody needed.

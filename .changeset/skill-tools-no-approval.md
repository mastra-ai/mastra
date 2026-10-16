---
"@mastra/core": patch
---

Skill tools (`skill`, `skill_read`, `skill_search`) no longer pause for approval when `requireToolApproval` is enabled globally. Previously every skill load in an approval-enabled agent (including durable agents) suspended for an approval nobody needed.

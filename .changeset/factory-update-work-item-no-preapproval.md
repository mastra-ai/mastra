---
'@mastra/factory': patch
---

`factory_update_work_item` no longer claims it can pre-approve a card's plans. A card has no pre-approval setting: a plan waits for a person unless the board's phase auto-approves it (`exitTool.autoApprove`). Agents no longer tell people a plan is pre-approved when it isn't.

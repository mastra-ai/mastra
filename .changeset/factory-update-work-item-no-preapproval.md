---
'@mastra/factory': patch
---

`factory_update_work_item` no longer claims it can pre-approve a card's plans. A card has no pre-approval setting: a plan waits for a person unless the board's phase auto-approves it (`exitTool.autoApprove`). Agents reading the tool description are no longer told they can pre-approve plans.

---
'@mastra/factory': patch
---

Fixed webhook events being silently lost when a work item changed while a rule was being evaluated. Losing that race no longer records the event as a rejected, decision-less ingress. Factory now re-reads the work item and re-runs the rule (up to three attempts). If the item keeps changing, the delivery fails visibly so a redelivery is processed instead of being ignored as a duplicate.

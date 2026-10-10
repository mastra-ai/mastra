---
'@mastra/factory': patch
---

Fixed supervisor health missing stranded cards. A card in a working phase is now reported as `seat-missing` when nothing for that phase's role can move it, even if an earlier phase left a seat or a parked proposal behind. For example, a Planning card whose plan run failed is no longer hidden by a leftover triage proposal or triage seat. Pending decisions without a role, such as a queued transition, still count as moving the card.

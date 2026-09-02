---
'@mastra/factory': patch
---

Fix a false "Automated run could not start" failure on cards whose plan agent handed the card straight on to Build. Every role on a card shares one session, so when the plan agent moved the card mid-turn the build kickoff landed on the same run and the plan decision stayed attached to it; if that run later ended in error the plan decision was charged with it, then retried into a seat that no longer existed and went red even though the plan and the build had both finished. A decision whose role has been replaced on its session by the next role now completes instead of failing or retrying.

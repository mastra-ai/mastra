---
'@mastra/factory': patch
---

**Fixed direct retriage from Planning.** Moving an issue card from Planning back to Triage starts a fresh investigation without requiring an intermediate move through Intake. The declared board transition graph and pull-request lane restrictions remain enforced.

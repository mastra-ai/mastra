---
'@mastra/factory': minor
---

Added a hands-off start for work items.

**How it works**

Pick "Investigate hands-off" or "Build hands-off" in a card's menu instead of the plain start — restarts too: a card whose run already happened offers "Re-review hands-off" and a hands-off twin of its lane's run. "Prepare approval" has no twin — that run's outcome is a maintainer decision, which hands-off cannot remove. The run's parked plans are approved on your behalf, even while the project's Auto-approve plans switch stays off.

The grant sticks to the item, not the run, so the Factory's own follow-up runs on that card stay hands-off too. Other cards keep waiting for plan review, and a hands-off run that keeps re-planning still stops after three approvals.

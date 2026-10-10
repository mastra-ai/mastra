---
'@mastra/factory': patch
---

Supervisor health now flags a card that is stuck in a working phase, such as a Planning card whose plan run failed, even when leftover triage work is still attached to it. Previously a parked triage proposal or an old triage session hid the stuck card, so nothing reported that it needed a new run.

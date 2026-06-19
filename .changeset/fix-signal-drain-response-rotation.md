---
"@mastra/core": patch
---

Fix agent signal drains so pending signals are recorded through the canonical signal transcript path and consistently rotate the response message id. This prevents follow-up signal turns from being attached to the previous assistant response and helps the agent see the latest completed step before continuing.

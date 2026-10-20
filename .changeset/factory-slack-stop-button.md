---
'@mastra/factory': patch
---

Factory's Slack agent now runs as a Slack Agent Session, so Slack shows its native Stop button while a run is in flight and clicking it aborts the run. Existing Slack apps must add the `agent_session_stopped` bot event under Event Subscriptions.

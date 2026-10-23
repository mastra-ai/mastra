---
'@mastra/factory': patch
---

Factory's Slack agent now runs as a Slack Agent Session, so Slack shows its native Stop button while a run is in flight and clicking it aborts the run. The generated Slack manifest now declares `agent_view` instead of `assistant_view` and subscribes to `agent_session_stopped`.

Existing Slack apps must be migrated by hand. In the app's manifest, replace `features.assistant_view` with `features.agent_view` (keeping the description) and add the `agent_session_stopped` bot event. Slack can't move an app back, and users need to hard-refresh Slack afterwards.

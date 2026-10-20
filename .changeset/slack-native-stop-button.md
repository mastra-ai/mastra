---
'@mastra/core': patch
'@mastra/slack': patch
---

Added support for Slack's native stop button on agent responses. Clicking stop in Slack now aborts the agent's in-flight run for that thread. New Slack apps created by `@mastra/slack` subscribe to the `agent_session_stopped` event; for existing apps, add `agent_session_stopped` under Event Subscriptions → bot events.

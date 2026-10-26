---
'@mastra/core': patch
'@mastra/slack': patch
---

Added opt-in support for Slack's native Stop button. Set `agentSessions: true` on `SlackProvider` to run each agent turn as a Slack Agent Session: Slack shows Stop while the agent works, and clicking it aborts the agent's in-flight run for that thread. A run that fails before it streams anything ends the session too, so Stop doesn't linger.

It's off by default because while a session is `processing`, Slack shows its own "Working…" in place of custom typing statuses like "is thinking…".

Apps the provider manages subscribe to the `agent_session_stopped` bot event: new apps on creation, existing apps on the next startup. For a Slack app you manage yourself, add the event by hand:

```yaml
settings:
  event_subscriptions:
    bot_events:
      - agent_session_stopped
```

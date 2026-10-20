---
'@mastra/core': patch
'@mastra/slack': patch
---

Added support for Slack's native Stop button. Set `agentView: true` on `SlackProvider` to run the agent as a Slack Agent Session: each run marks the thread `processing`, Slack shows Stop while the agent works, and clicking it aborts the agent's in-flight run for that thread. `createSlackAdapter` from `@mastra/slack` carries the typing bridge this needs, so Mastra's text statuses (`is thinking…`, tool steps) still render while the session stays stoppable.

New Slack apps created by `@mastra/slack` subscribe to the `agent_session_stopped` event automatically. Existing Slack apps aren't updated automatically. Add the event in your app manifest:

```yaml
settings:
  event_subscriptions:
    bot_events:
      - agent_session_stopped
```

---
'@mastra/core': patch
'@mastra/slack': patch
---

Added support for Slack's native Stop button. Set `agentView: true` on `SlackProvider` to run the agent as a Slack Agent Session: each run marks the thread `processing`, Slack shows Stop while the agent works, and clicking it aborts the agent's in-flight run for that thread. `createSlackAdapter` from `@mastra/slack` carries the typing bridge this needs, so Mastra's text statuses (`is thinking…`, tool steps) still render while the session stays stoppable. A run that fails before it streams anything now ends the session too, so Stop doesn't linger.

With `agentView: true`, apps the provider manages move to Slack's Agent messaging experience: the manifest declares `agent_view` instead of `assistant_view` and subscribes to `agent_session_stopped`. New apps get this on creation, existing apps on the next startup. Slack can't move an app back, and users need to hard-refresh Slack after the switch.

Slack apps you manage yourself aren't updated. Switch the manifest by hand:

```yaml
features:
  agent_view:
    agent_description: Your agent's description
settings:
  event_subscriptions:
    bot_events:
      - agent_session_stopped
```

Remove `features.assistant_view`: Slack rejects a manifest that declares both.

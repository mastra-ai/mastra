---
'@mastra/slack': patch
---

Slack apps that `SlackProvider` creates now declare `agent_view` instead of the deprecated `assistant_view`, which Slack retires in February 2027. Users can now keep messaging the agent in a DM while it works. Under `assistant_view`, Slack locked the composer while a status like "is working…" was showing.

Apps created before this change switch to `agent_view` the next time the provider starts. Slack can't move an app back, and users need to hard-refresh Slack afterwards.

If you manage your Slack app's manifest yourself, replace `features.assistant_view` with `features.agent_view`:

```yaml
features:
  agent_view:
    agent_description: Your agent's description
```

Slack rejects a manifest that declares both.

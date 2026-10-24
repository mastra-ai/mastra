---
'@mastra/slack': patch
---

Slack apps that `SlackProvider` creates now declare `agent_view` instead of `assistant_view`, which Slack says it will deprecate. Users can now keep messaging the agent in a DM while it works. Under `assistant_view`, Slack locked the composer while a status like "is working…" was showing.

Apps that `SlackProvider` created and manages switch to `agent_view` the next time the provider starts. The switch keeps customizations made with `connect({ manifest })`, except slash commands, which are regenerated from `slashCommands`. DMs with the app then use Slack's agent layout instead of the assistant chat list, and users may need to hard-refresh Slack. Slack documents the switch from `assistant_view` to `agent_view` as one that can't be reversed. Apps owned by an `AgentController` are not updated automatically; edit their manifest as described below.

If you manage your Slack app's manifest yourself, replace `features.assistant_view` with `features.agent_view`:

```yaml
features:
  agent_view:
    agent_description: Your agent's description
```

Slack rejects a manifest that declares both.

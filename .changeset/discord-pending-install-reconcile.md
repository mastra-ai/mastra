---
'@mastra/discord': minor
---

Fixed Discord installs staying "pending" forever after completing the bot invite. Discord's invite flow doesn't notify the server when it finishes, so the provider now exposes `reconcileInstallation(agentId)` — it activates a pending install when the server can attribute the newly joined guild to it, and Studio calls it when you return, so the agent shows "Connected" right away:

```ts
const info = await discord.reconcileInstallation('my-agent');
// info?.status === 'active' once the invite finished
```

When the new guild can't be attributed safely (several invites in flight, or the bot joined more than one guild), the install stays pending and activates on its first interaction, as before. Invite attribution expires after 30 minutes and never crosses a bot credential change. `listInstallations()` is now a pure read.

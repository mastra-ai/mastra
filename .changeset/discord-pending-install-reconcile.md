---
'@mastra/discord': patch
---

Fixed Discord installs staying "pending" forever after completing the bot invite. Discord's invite flow doesn't notify the server when it finishes, so the install now activates when the server can attribute the newly joined guild to it — returning to Studio shows "Connected" without waiting for someone to use the bot. When the new guild can't be attributed safely (several invites in flight, or the bot joined more than one guild), the install stays pending and activates on its first interaction, as before. Invite attribution expires after 30 minutes and never crosses a bot credential change.

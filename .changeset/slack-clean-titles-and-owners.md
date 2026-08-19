---
'@mastra/factory': patch
---

Slack-born work items are now titled with what was said. A message that starts by mentioning the bot used to become a card named `@U0BMHEJ7RLY your turn to work on the…`; it now reads `your turn to work on the tasks`, on a single line.

Slack messages in the chat transcript read as messages too. The thread history the agent was given used to be dumped into the bubble as `[Thread context — messages…]` followed by `[Ada Lovelace (<@U0B9NEZ90KH>)] (msg:1787155628.734549): …` lines; it now collapses into a `2 earlier messages` row that expands into named, timestamped messages, and the bubble keeps only what was said — with the bot addressed by name instead of `@U0BMHEJ7RLY`.

Sessions listed for a project also carry their owner's display profile, so a workspace sidebar can attribute a session to a person instead of to a `user_01KN527V…` id. Resolution goes through the auth provider (`IUserProvider`); providers that cannot resolve users by id simply leave the owner unnamed.

```jsonc
// GET /web/github/projects/:id/sessions
{
  "sessions": [
    {
      "sessionId": "…",
      "userId": "user_01KN527V…",
      "owner": { "id": "user_01KN527V…", "name": "Ada Lovelace", "avatarUrl": "https://…" },
    },
  ],
}
```

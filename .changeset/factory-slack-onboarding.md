---
'@mastra/factory': patch
---

Reworks what Slack users see when they talk to the Factory bot.

**Immediate feedback.** The bot shows an "is thinking…" status as soon as a message is accepted, before session setup and model latency. A new session's first reply is followed by an `Open session ↗` link to the web session (requires `MASTRACODE_PUBLIC_URL`). Slack shows it as its own short message right after the reply. The link is Slack-only: it is not saved to the thread, so the model never sees it and the web transcript does not show it. The old "Started a session" paragraph is gone.

**Acknowledge, then work.** For requests that need tools, the bot opens with one short line saying what it is about to do (e.g. "On it — running sleep 30, then the echo") as its own message, then the work follows. Direct answers skip the opener.

**Progress in the status line.** While a tool runs, the typing status names its current step from the tool's `description` argument — "DAS Factory is listing the repo root" — and falls back to "is working…" when there is none. Tool calls themselves stay out of the thread (`toolDisplay: 'hidden'`, as before); a session runs hundreds of them and the `Open session ↗` link carries the full trace.

To render tool activity in Slack's native "Thinking Steps" widget instead, opt in through `adapterOptions` on `SlackIntegration`:

```ts
new SlackIntegration({
  // ...credentials
  adapterOptions: { toolDisplay: 'grouped' },
});
```

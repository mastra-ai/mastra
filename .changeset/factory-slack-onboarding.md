---
'@mastra/factory': patch
---

Reworks what Slack users see when they talk to the Factory bot.

**Immediate feedback.** The bot shows an "is thinking…" status as soon as a message is accepted, before session setup and model latency. A new session's first reply ends with a bare `↗` link to the web session, in the same message rather than posted separately (requires `MASTRACODE_PUBLIC_URL`). The old "Started a session" paragraph is gone.

**Acknowledge, then work.** For requests that need tools, the bot opens with one short line saying what it is about to do (e.g. "On it — running sleep 30, then the echo") as its own message, then the work follows. Direct answers skip the opener.

**Visible progress.** Tool activity renders in Slack's native "Thinking Steps" widget (`toolDisplay: 'grouped'`) instead of being hidden. The widget header is a fixed "Working…"; each row shows the tool's description when it has one, otherwise the tool name and a short argument summary.

Override the display mode through `adapterOptions` on `SlackIntegration`:

```ts
new SlackIntegration({
  // ...credentials
  adapterOptions: { toolDisplay: 'hidden' },
});
```

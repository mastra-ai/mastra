---
'@mastra/factory': patch
---

Reworks what Slack users see when they talk to the Factory bot.

**Suggested prompts.** A new AI Assistant thread with the bot pins four starters: "What can you do?", "Investigate an issue", "Plan a change", "Build and open a PR". Regenerate your Slack app manifest to subscribe to `assistant_thread_started`; without it the prompts don't appear.

**Immediate feedback.** The bot shows an "is thinking…" status as soon as a message is accepted, before session setup and model latency. A new session's first reply opens with a bare `↗` link to the web session, folded into the same message rather than posted separately (requires `MASTRACODE_PUBLIC_URL`). The old "Started a session" paragraph is gone.

**Acknowledge, then work.** For requests that need tools, the bot opens with one short line saying what it is about to do (e.g. "On it — running sleep 30, then the echo") as its own message, then the work follows. Direct answers skip the opener.

**Visible progress.** Tool activity renders in Slack's native "Thinking Steps" widget (`toolDisplay: 'grouped'`) instead of being hidden. The widget header is a fixed "Working…" and each row shows the tool's description.

Override the display mode or prompts through `adapterOptions` on `SlackIntegration`:

```ts
new SlackIntegration({
  // ...credentials
  adapterOptions: {
    toolDisplay: 'hidden',
    suggestedPrompts: {
      title: 'Try asking',
      prompts: [{ title: 'Triage the backlog', message: 'Triage the open issues and summarize the top three.' }],
    },
  },
});
```

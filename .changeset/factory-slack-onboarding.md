---
'@mastra/factory': patch
---

Slack onboarding: a new AI Assistant thread with the Factory bot now pins suggested prompts ("What can you do?", "Investigate an issue", "Plan a change", "Build and open a PR"). Tool activity renders in Slack's native "Thinking Steps" widget (`toolDisplay: 'grouped'`) instead of being hidden. Regenerate your Slack app manifest to subscribe to `assistant_thread_started`.

Override any of these through `adapterOptions` on `SlackIntegration`:

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

The bot no longer posts a static "Started a session" message. Channel-triggered runs get a system instruction to open with one short line saying what it is about to do (e.g. "On it — running sleep 30, then the echo"), ending with a `↗` link to the session when `MASTRACODE_PUBLIC_URL` is set. The bot also sets an "is thinking..." status as soon as a message is accepted, before session setup and model latency, so Slack users see a response immediately.

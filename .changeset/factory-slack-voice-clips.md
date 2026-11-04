---
'@mastra/factory': patch
---

Slack voice clips now reach the agent as text. When someone sends a voice clip to a Factory session in Slack, Factory transcribes it with the sender's own speech-to-text key and their Voice input model choice, then gives the agent the transcript next to the clip. If the clip can't be transcribed (no key, too long, provider error), the agent gets a note saying why so it can tell the sender.

Added a `listenChannels` option to `SlackIntegration` for channels where a new top-level message starts a session without tagging the bot, such as a dedicated voice-notes channel:

```ts
new SlackIntegration({ signingSecret, botToken, listenChannels: ['C0123456789'] });
```

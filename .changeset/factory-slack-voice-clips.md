---
'@mastra/factory': minor
---

Slack voice clips now reach the agent as text. When someone sends a voice clip to a Factory session in Slack (tagging the bot, in a DM, or in a thread the bot is already in), Factory transcribes it and the transcript becomes the message, so the agent answers it like a typed message. The thread's Factory decides whose model and key apply: a Factory with the **factory** model scope uses its own voice model from **Settings → Models → Voice input** and the organization's key; any other scope uses the sender's own voice model and personal key, never the organization's. If the clip can't be transcribed (no key, too long, can't be downloaded, timed out, provider error), the clip stays attached and the agent gets a note naming the clip and saying why, so it can tell the sender.

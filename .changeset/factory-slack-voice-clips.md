---
'@mastra/factory': patch
---

Slack voice clips now reach the agent as text. When someone sends a voice clip to a Factory session in Slack (tagging the bot, in a DM, or in a thread the bot is already in), Factory transcribes it and gives the agent the transcript next to the clip. The model and key follow the Factory's model scope and **Settings → Models → Voice input**, the same as the composer mic. If the clip can't be transcribed (no key, too long, provider error), the agent gets a note saying why so it can tell the sender.

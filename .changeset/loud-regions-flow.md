---
'@mastra/factory': minor
'@mastra/slack': patch
'@mastra/core': patch
---

Tag the bot with `@bot mute` in a Slack thread to make it ignore messages there until someone tags it with `@bot unmute`. Messages that tag the bot are still answered while it's muted, and the bot confirms with a reaction instead of a reply.

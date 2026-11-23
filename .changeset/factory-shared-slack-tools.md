---
'@mastra/factory': patch
---

Factory's Slack tools now come from `createChannelTools()` in `@mastra/core/channels` and `createSlackTools()` in `@mastra/slack`. The limits stay the same, with three changes to the tools:

- The channel tools reject ids without a platform prefix, such as `C0123ABC`, with a hint to use the full id, such as `slack:C0123ABC`. The Slack-only tools still add the `slack:` prefix for you.
- `sendDirectMessage` takes `{ userId, message }` instead of `{ userId, text }`, like the other posting tools.
- Group DMs the bot is in are now refused like other people's DMs, even with `channels: 'all'`.

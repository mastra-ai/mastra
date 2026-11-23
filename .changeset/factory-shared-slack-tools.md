---
'@mastra/factory': patch
---

Factory's Slack tools now come from `createChannelTools()` in `@mastra/core/channels` and `createSlackTools()` in `@mastra/slack`. The tools and their limits stay the same. The channel tools now reject ids without a platform prefix, such as `C0123ABC`, with a hint to use the full id, such as `slack:C0123ABC`. The Slack-only tools still add the `slack:` prefix for you.

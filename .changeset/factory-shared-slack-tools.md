---
'@mastra/factory': patch
---

Factory's Slack tools now come from `createChannelTools()` in `@mastra/core/channels` and `createSlackTools()` in `@mastra/slack`. The tools and their limits stay the same. Ids without a platform prefix, such as `C0123ABC`, are now rejected with a hint to use the full id, such as `slack:C0123ABC`.

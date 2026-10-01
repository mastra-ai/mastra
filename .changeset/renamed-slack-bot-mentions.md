---
'@mastra/core': patch
---

Fixed chat channel agents ignoring mentions of their current display name after being renamed. For example, a Slack app renamed from `acme-bot` to `helper` now responds to `@helper` in channels, instead of only recognising its original username. The bot's current profile name is looked up once through the adapter and exposed as `botDisplayName` on the channel context.

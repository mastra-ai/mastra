---
'@mastra/core': minor
---

Added `ChannelToolAnnouncementProcessor` to `@mastra/core/channels`. It posts into a run's chat thread when a tool call succeeds and the host's `announce` function returns markdown, such as a link to a pull request the agent just opened. Pass `channels` so runs that did not start in the channel announce too.

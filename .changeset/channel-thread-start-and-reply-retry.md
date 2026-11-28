---
'@mastra/playground-ui': minor
---

Added two parts for chats that come in from Slack:

- **`ChannelThreadStart`** opens a channel thread with where it started and who started it, for example "Started in sales by Charlie". Pass `channelUrl` and the channel name links to the channel in Slack.
- The new **`ChannelReplyError`** transcript slot draws a host's recovery actions, such as Try again and Reconnect Slack, next to a reply that failed to post. Without it, a failed reply only says it failed.

```tsx
<TranscriptSlotsProvider
  slots={{ ChannelReplyError: ({ toolCallId, text }) => <RetryReply id={toolCallId} text={text} /> }}
>
  <TranscriptEntries {...transcriptProps} />
</TranscriptSlotsProvider>
```

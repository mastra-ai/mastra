---
'@mastra/core': minor
'@mastra/server': patch
'@mastra/libsql': patch
'@mastra/pg': patch
---

Added platform channels framework with ChannelProvider interface, ChannelsStorage domain, and ChannelConnectResult discriminated union supporting OAuth, deep link, and immediate connection flows. Channels can be registered on the Mastra instance and expose connect/disconnect/list APIs for platform integrations.

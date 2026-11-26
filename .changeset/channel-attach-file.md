---
'@mastra/core': minor
---

Added `createChannelAttachFileTool()` to `@mastra/core/channels`: an `attach_file` tool that uploads a file from the run's workspace into its chat thread, including on runs that did not start there when `channels` is passed. Files over 50 MB are refused, and a Slack app missing `files:write` gets an error naming the scope.

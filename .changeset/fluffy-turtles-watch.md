---
'@mastra/core': minor
'@mastra/factory': patch
---

Added a `read_attachment` channel tool so agents can read files shared in a chat thread, such as a CSV uploaded to Slack, without saving a copy anywhere. Each call downloads the file through the adapter's authenticated fetch and returns one chunk (up to 128 KiB), so the agent can page through files too large to show inline. The tool only reads files attached to messages in the current thread. Truncated text attachments now include their URL so the agent can read the rest.

```typescript
const agent = new Agent({
  // ...
  tools: { ...channels.getTools() }, // now includes read_attachment
});
```

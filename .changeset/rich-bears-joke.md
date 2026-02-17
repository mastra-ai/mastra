---
'@mastra/core': patch
---

Fixed network mode messages missing metadata for filtering. All internal network messages (sub-agent results, tool execution results, workflow results) now include `metadata.mode: 'network'` in their content metadata, making it possible to filter them from user-facing messages without parsing JSON content. Previously, consumers had to parse the JSON body of each message to check for `isNetwork: true` — now they can simply check `message.content.metadata.mode === 'network'`. Fixes #13106.

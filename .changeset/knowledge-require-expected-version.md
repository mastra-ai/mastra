---
'@mastra/core': minor
---

Added `requireExpectedVersion` to `Knowledge.createTools()`. When it's set, the `knowledge_page` tool refuses to edit, move, merge or delete a page unless the call passes `expectedVersion`, instead of using the version the tool just read. Use it for agents that write without a person watching, so a write planned from an older read can't overwrite a newer change. Creating a page doesn't need a version. It's off by default.

```ts
const tools = knowledge.createTools({
  read: true,
  write: true,
  principals: ['agent:curator'],
  requireExpectedVersion: true,
});
```

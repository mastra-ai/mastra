---
'@mastra/server': patch
'@mastra/client-js': patch
'@internal/playground': patch
---

Added `modelListEditable` to agent details so clients can disable model-list editing when an agent resolves its models dynamically. Studio now shows function-valued model lists as read-only while keeping static model lists editable.

```ts
const agent = client.getAgent('weather-agent');
const details = await agent.details();

if (details.modelListEditable === false) {
  // Hide or disable model-list editing controls.
}
```

---
'@mastra/ai-sdk': patch
---

Pass `background-task-*` lifecycle chunks through to the UI message stream as `data-*` parts. When an agent dispatches a tool as a background task, `toAISdkStream` / `handleChatStream` previously dropped the `background-task-started` chunk, so a web-chat UI could not get the `taskId` and had to regex-parse it out of the tool-result string. The chunk now arrives as a typed data part, giving the frontend the `taskId` at dispatch time to render a live progress card and subscribe to the task's lifecycle.

```ts
// In your useChat data-part handler:
if (part.type === 'data-background-task-started') {
  const { taskId, toolName, toolCallId } = part.data;
  // open a task-scoped subscription, render a "running" card, etc.
}
```

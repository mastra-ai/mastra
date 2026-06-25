---
'@mastra/ai-sdk': patch
---

Fixed background task IDs not reaching the chat UI. When an agent starts a tool as a background task, your frontend now receives the task's ID the moment it starts, instead of having to dig it out of the tool's result text. This lets you show a "task running" card and follow the task's progress right away while the user keeps chatting.

```ts
// In your useChat data-part handler:
if (part.type === 'data-background-task-started') {
  const { taskId, toolName, toolCallId } = part.data;
  // render a "running" card and subscribe to the task by taskId
}
```

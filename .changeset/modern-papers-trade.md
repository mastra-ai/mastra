---
'@mastra/playground-ui': patch
---

Tool calls in chat now show what they do. Knowledge, files, terminal, browser, delegation, workflows, schedules, notifications, source control and skills each get distinct icons, and a running call moves the way its action does: a Knowledge page grows a new connection, a website is read line by line, keys are pressed while typing. Icons also read more clearly at small sizes.

Knowledge moves, merges, deletions, notes and pins show the actual operation in live activity and in completed cards, so deleting a page no longer looks like editing it. Namespaced tools such as `mcp__workspace__read_file` or `workspace.read_file`, and common aliases, get the same icon as the tool they wrap. Unknown tools keep the generic icon.

**Removed `callPose`** from `@mastra/playground-ui/domains/chat/activity`. Read the pose from `presentTool` with the call's arguments, so the icon follows the operation:

```ts
// Before
callPose(call.toolName);

// After
presentTool(call.toolName, call.args).pose;
```

---
'@mastra/playground-ui': minor
---

Removed `callPose` from `@mastra/playground-ui/domains/chat/activity`. Use `presentTool(toolName, args).pose` so the icon reflects the call's operation, including Knowledge moves, merges and deletions.

**Before**

```ts
import { callPose } from '@mastra/playground-ui/domains/chat/activity';

const pose = callPose(call.toolName);
```

**After**

```ts
import { presentTool } from '@mastra/playground-ui/components/ai/tool-call';

const pose = presentTool(call.toolName, call.args).pose;
```

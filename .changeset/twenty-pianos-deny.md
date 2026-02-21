---
'@mastra/core': minor
---

Refactored all Harness class methods to accept object parameters instead of positional arguments, and standardized method naming.

**Why:** Positional arguments make call sites harder to read, especially for methods with optional middle parameters or multiple string arguments. Object parameters are self-documenting and easier to extend without breaking changes.

- Methods returning arrays use `list` prefix (`listModes`, `listAvailableModels`, `listMessages`, `listMessagesForThread`)
- `persistThreadSetting` → `setThreadSetting`
- `resolveToolApprovalDecision` → `respondToToolApproval` (consistent with `respondToQuestion` / `respondToPlanApproval`)
- `setPermissionCategory` → `setPermissionForCategory`
- `setPermissionTool` → `setPermissionForTool`

**Before:**

```typescript
await harness.switchMode('build');
await harness.sendMessage('Hello', { images });
const modes = harness.getModes();
const models = await harness.getAvailableModels();
harness.resolveToolApprovalDecision('approve');
```

**After:**

```typescript
await harness.switchMode({ modeId: 'build' });
await harness.sendMessage({ content: 'Hello', images });
const modes = harness.listModes();
const models = await harness.listAvailableModels();
harness.respondToToolApproval({ decision: 'approve' });
```

The `HarnessRequestContext` interface methods (`registerQuestion`, `registerPlanApproval`, `getSubagentModelId`) are also updated to use object parameters.

---
'@mastra/core': minor
---

Added `Workspace.getInstructions()` method that is mount-state-aware — classifies each mount path as sandbox-accessible or workspace-only based on actual mount state. Added `WorkspaceInstructionsProcessor` that automatically injects workspace environment instructions into the agent system message, replacing the previous approach of embedding path context in tool descriptions. Deprecated `getPathContext()` in favor of `getInstructions()`.

Added `instructions` option to `LocalFilesystem` and `LocalSandbox`. Pass a string to fully replace auto-generated instructions, or a function to extend them with access to the current `requestContext` for per-request customization (e.g. by tenant or locale).

```typescript
const filesystem = new LocalFilesystem({
  basePath: './workspace',
  instructions: ({ auto, requestContext }) => {
    const locale = requestContext?.get('locale') ?? 'en';
    return `${auto}\nLocale: ${locale}`;
  },
});
```

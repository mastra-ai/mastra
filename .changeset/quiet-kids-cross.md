---
'@mastra/core': minor
---

**Workspace instruction improvements**

- Added `Workspace.getInstructions()`: agents now receive accurate workspace context that distinguishes sandbox-accessible paths from workspace-only paths.
- Added `WorkspaceInstructionsProcessor`: workspace context is injected directly into the agent system message instead of embedded in tool descriptions.
- Deprecated `Workspace.getPathContext()` in favour of `getInstructions()`.

Added `instructions` option to `LocalFilesystem` and `LocalSandbox`. Pass a string to fully replace default instructions, or a function to extend them with access to the current `requestContext` for per-request customization (e.g. by tenant or locale).

```typescript
const filesystem = new LocalFilesystem({
  basePath: './workspace',
  instructions: ({ defaultInstructions, requestContext }) => {
    const locale = requestContext?.get('locale') ?? 'en';
    return `${defaultInstructions}\nLocale: ${locale}`;
  },
});
```

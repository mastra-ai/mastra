---
'@mastra/core': minor
---

Added a `guardToolCall` hook that decides each tool call before it runs. Return `allow` to run it, `deny` with a reason to refuse it (the model sees the reason and other calls in the step still run), or `ask` to suspend for human approval. Approval rules (`requireToolApproval`, `requireApproval`, `needsApprovalFn`) take precedence, and repeated denials escalate to `ask`; the denial counts carry across suspend and resume. Tools can also set their own `guard` in `createTool`, which decides calls the agent guard allowed.

```ts
const agent = new Agent({
  // ...
  hooks: {
    guardToolCall: ({ toolName, args }) => {
      if (toolName !== 'runShell') return { action: 'allow' };
      const { command } = args as { command: string };
      if (command.startsWith('rm -rf /')) {
        return { action: 'deny', reason: 'Deleting the filesystem root is not allowed.' };
      }
      return { action: 'ask' };
    },
  },
});
```

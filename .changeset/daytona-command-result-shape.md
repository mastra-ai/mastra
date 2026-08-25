---
'@mastra/daytona': patch
---

Fixed a leak where every command left its process handle behind, by removing Daytona's own `executeCommand` in favour of the shared one, which releases them.

Command results now match every other provider: `command` holds the full command string, and the separate `args` array is gone.

```typescript
const result = await sandbox.executeCommand('echo', ['hello'])
// before: result.command === 'echo',       result.args === ['hello']
// after:  result.command === 'echo hello', result.args === undefined
```

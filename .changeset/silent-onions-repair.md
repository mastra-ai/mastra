---
'@mastra/core': minor
---

Added a `requireDescription` option to the workspace `execute_command` tool. When enabled, the tool asks the model for a short plain-language `description` of each command, listed before `command` in the tool schema, so UIs can show it instead of the raw command. The option is off by default and the tool schema is unchanged when it is off.

```ts
const workspace = new Workspace({
  sandbox,
  tools: {
    [WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND]: { requireDescription: true },
  },
});
```

---
'@mastra/core': minor
---

Added an optional `description` input to the workspace `execute_command` tool. Agents can pass a short plain-language summary of what a command does, so UIs can show it instead of the raw command. The command runs the same way whether or not a description is set.

```json
{
  "command": "gh run view 12347890 --log-failed | grep -E 'FAIL|Error'",
  "description": "Drilling into the failed CI job"
}
```

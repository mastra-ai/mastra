---
'@mastra/core': minor
---

Workspace sandbox tool results (`execute_command`, `kill_process`, `get_process_output`) sent to the model now strip ANSI color codes via `toModelOutput`, while streamed output to the user keeps colors. This reduces token usage and improves model readability.

Workspace `execute_command` tool now extracts trailing `| tail -N` pipes from commands so output streams live to the user, while the final result sent to the model is still truncated to the last N lines.

Workspace tools that return potentially large output now enforce a token-based output limit (~3k tokens by default) using tiktoken for accurate counting. The limit is configurable per-tool via `maxOutputTokens` in `WorkspaceToolConfig`. Each tool uses a truncation strategy suited to its output:
- `read_file`, `grep`, `list_files` — truncate from the end (keep imports, first matches, top-level tree)
- `execute_command`, `get_process_output`, `kill_process` — head+tail sandwich (keep early output + final status)

```ts
const workspace = new Workspace({
  tools: {
    mastra_workspace_execute_command: {
      maxOutputTokens: 5000, // override default 3k
    },
  },
});
```

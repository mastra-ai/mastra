---
'@mastra/react': patch
---

Restore network-mode message accumulation in `useChat`. Network runs and network approval/decline continuations once again populate `useChat().messages` with `MastraDBMessage` objects carrying `content.metadata.mode === 'network'`, so consumers can render routing text, agent/workflow/tool execution, suspensions, approvals, and completion feedback from the chunk stream. `onNetworkChunk` continues to fire for side-effects.

The React SDK continues to expose the new MastraDB message surface instead of reintroducing the removed AI SDK / assistant-ui helper exports such as `toUIMessage`, `toAssistantUIMessage`, and `resolveToChildMessages`; restoring those helpers would require bringing back dependencies this branch intentionally removed.

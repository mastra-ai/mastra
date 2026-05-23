---
'@mastra/core': minor
---

channels: custom `onAction` / `onReaction` handlers and programmatic tool approval

Adds three additive surfaces for building custom tool-approval flows on top of the existing `toolDisplay: fn` API. Zero breaking changes — existing approval flows behave exactly as before when no overrides are provided.

**`handlers.onAction`** — override the default action (button click) handler. The default routes built-in `tool_approve:<toolCallId>` / `tool_deny:<toolCallId>` action IDs through the tool approval flow and edits the approval card. Pair with `toolDisplay: fn` posting custom buttons to handle custom action IDs:

```ts
channels: {
  handlers: {
    onAction: async (event, defaultHandler) => {
      if (event.actionId.startsWith('explain:')) {
        await event.thread?.post('Here is what this tool does…')
        return
      }
      return defaultHandler() // built-in tool_approve / tool_deny
    },
  },
}
```

The override returns `{ kind: 'approved' | 'denied' | 'unknown' }` from `defaultHandler()` so user code can branch on what the default did.

**`handlers.onReaction`** — override the (default no-op) reaction handler. Pair with `channels.approveTool` / `denyTool` to drive approvals via reactions on platforms without buttons:

```ts
channels: {
  handlers: {
    onReaction: async (event) => {
      const toolCallId = pendingApprovals.get(event.messageId)
      if (!toolCallId) return
      if (event.emoji === 'white_check_mark') await agent.channels.approveTool(toolCallId, event)
      else if (event.emoji === 'x') await agent.channels.denyTool(toolCallId, event)
    },
  },
}
```

**`channels.approveTool(toolCallId, source)` / `channels.denyTool(toolCallId, source)`** — programmatic approval methods on the `AgentChannels` instance. Resolve a suspended tool from a custom event handler, a workflow, or any code path. Source can be an `ActionEvent`, a `ReactionEvent`, or an explicit `{ chatThread, platform, actor }` for non-event-driven approvals. Neither method edits any message — the caller owns UI. Silently returns if no pending approval exists for the given `toolCallId` (e.g. stale click).

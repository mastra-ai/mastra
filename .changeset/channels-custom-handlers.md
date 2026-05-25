---
'@mastra/core': minor
---

channels: custom `onAction` / `onReaction` handlers and programmatic tool approval

- `handlers.onAction` — override the default action (button click) handler. Receives `defaultHandler()` which runs the built-in `tool_approve:*` / `tool_deny:*` routing.
- `handlers.onReaction` — override the (default no-op) reaction handler.
- `channels.approveTool(toolCallId, source)` / `channels.denyTool(toolCallId, source)` — public methods on `AgentChannels` for resolving suspended tool approvals from custom handlers or workflows. `source` is an `ActionEvent`, `ReactionEvent`, or `{ chatThread, platform, actor }`.

When supplied, the override fully owns the event — the default handler runs only if you call `defaultHandler()` explicitly (matches existing `onMessage` / `onMention` / `onSubscribedMessage` semantics). Zero breaking changes.

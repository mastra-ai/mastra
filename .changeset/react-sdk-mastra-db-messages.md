---
'@mastra/react': patch
---

Rewrite `@mastra/react` to emit `MastraDBMessage[]` directly from `useChat`, remove the AI SDK + assistant-ui adapter layers, and restore network-mode parity on the new message surface. Pre-v1 package, so breaking changes are allowed under the current major.

**Message shape**

- `useChat().messages` and `UseChatOptions.initialMessages` are now `MastraDBMessage[]` end-to-end. Mode/approval/suspension/network metadata lives in `message.content.metadata`.
- Removed exports: `MastraUIMessage`, `MastraUIMessageMetadata`, `ExtendedMastraUIMessage`, `MastraExtendedTextPart`, `toUIMessage`, `toAssistantUIMessage`, `AISdkNetworkTransformer`, transformer types, `fromCoreUserMessageToUIMessage`, and the re-exports of `toAISdkMessages` / `toAISdkV4Messages` / `toAISdkV5Messages`.
- The React SDK no longer depends on `@assistant-ui/react` or `@ai-sdk/react`.
- Internal type safety in `useChat` was improved by removing unsafe type casts.

**Network mode**

- Network runs and network approval/decline continuations once again populate `useChat().messages` with `MastraDBMessage` objects carrying `content.metadata.mode === 'network'`, so consumers can render routing text, agent/workflow/tool execution, suspensions, approvals, and completion feedback from the chunk stream. `onNetworkChunk` continues to fire for side-effects.
- The user message is no longer appended twice when calling `sendMessage({ mode: 'network', ... })`.
- Routing-agent decisions are no longer rendered as a raw JSON code block. `routing-agent-text-delta` chunks are buffered, parsed once a JSON object is balanced, and stored on the assistant message's `content.metadata.routingDecision` (with a `routingDecisionText` fallback for non-JSON routing prose). The playground surfaces the parsed decision through the existing agent/tool/workflow network-choice metadata dialog.
- After a page reload, the persisted network routing-decision JSON is no longer shown as a raw text message. The playground converter reconstructs the persisted `{ "isNetwork": true, ... }` text part into the same network `dynamic-tool`/metadata message that streaming produces (`mode: 'network'`, `from`, `selectionReason`, `agentInput`, plus `childMessages`/`result` derived from `finalResult`), so the nested agent/tool/workflow badge and its child messages render identically whether the run just streamed or was restored on reload (network mode is being deprecated).

**Migration**

- Import AI SDK adapters from `@mastra/ai-sdk/ui` (`toAISdkV5Messages`, `toAISdkV4Messages`).
- For assistant-ui integration, convert `MastraDBMessage[] -> AI SDK UIMessage[]` with `toAISdkV5Messages` from `@mastra/ai-sdk/ui`, then bridge to `ThreadMessageLike[]` with `useExternalMessageConverter` from `@assistant-ui/react` (or implement a local converter against `MastraDBMessage` directly).
- Consume `useChat().messages` as `MastraDBMessage[]`; mode/approval/suspension/network metadata now lives in `message.content.metadata`.

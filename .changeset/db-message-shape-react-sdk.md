---
'@mastra/react': patch
---

Rewrite `@mastra/react` to emit `MastraDBMessage[]` directly from `useChat` and remove the AI SDK + assistant-ui adapter layers. Pre-v1 package, so breaking changes are allowed under the current major.

**Changes**

- Removed exports: `MastraUIMessage`, `MastraUIMessageMetadata`, `ExtendedMastraUIMessage`, `MastraExtendedTextPart`, `toUIMessage`, `toAssistantUIMessage`, `AISdkNetworkTransformer`, transformer types, `fromCoreUserMessageToUIMessage`, and the re-exports of `toAISdkMessages` / `toAISdkV4Messages` / `toAISdkV5Messages`.
- `useChat().messages` is now `MastraDBMessage[]` end-to-end. `UseChatOptions.initialMessages` is also `MastraDBMessage[]`.
- The React SDK no longer depends on `@assistant-ui/react` or `@ai-sdk/react`.

**Migration**

- Import AI SDK adapters from `@mastra/ai-sdk/ui` (`toAISdkV5Messages`, `toAISdkV4Messages`).
- For assistant-ui integration, convert `MastraDBMessage[] -> AI SDK UIMessage[]` with `toAISdkV5Messages` from `@mastra/ai-sdk/ui`, then bridge to `ThreadMessageLike[]` with `useExternalMessageConverter` from `@assistant-ui/react` (or implement a local converter against `MastraDBMessage` directly).
- Consume `useChat().messages` as `MastraDBMessage[]`; mode/approval/suspension/network metadata now lives in `message.content.metadata`.

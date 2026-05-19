---
'@mastra/core': minor
'@mastra/server': minor
'@mastra/client-js': minor
'@mastra/react': minor
'mastracode': patch
---

Narrowed `AgentSignalContents` from `BaseMessageListInput` to `string | (TextPart | FilePart)[]` and updated thread signal handling to use the simplified shape.

Fixed two signal-content bugs:

- `user-message` signal attributes now reach the LLM.
- Multimodal non-`user-message` signals no longer lose file parts.

Callers that previously passed wrapped message shapes to `agent.sendSignal` should now pass a bare string or a bare parts array.

Before:
`{ type: 'user-message', contents: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }] }`

After:
`{ type: 'user-message', contents: [{ type: 'text', text: 'hi' }] }`

Added an optional `providerOptions` field to `agent.sendSignal` that flows through to the resulting prompt turn as `providerOptions` on the LLM message and is persisted on the stored signal message as `content.providerMetadata`.

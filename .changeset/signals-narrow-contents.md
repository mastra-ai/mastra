---
'@mastra/core': minor
'@mastra/server': minor
'@mastra/client-js': minor
'@mastra/react': minor
---

Narrowed `AgentSignalContents` from `BaseMessageListInput` to `string | (TextPart | FilePart)[]`.

Fixed two signal-content bugs:

- `user-message` signal attributes now reach the LLM
- multimodal non-`user-message` signals no longer lose file parts

Callers that previously passed wrapped message shapes to `agent.sendSignal` should now pass a bare string or a bare parts array.

Before:
`{ type: 'user-message', contents: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }] }`

After:
`{ type: 'user-message', contents: [{ type: 'text', text: 'hi' }] }`

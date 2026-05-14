---
'@mastra/core': minor
---

Narrow `AgentSignalContents` (the `contents` field on `user-message` signals) to `string | (TextPart | FilePart)[]`.

Previously the field accepted the full `BaseMessageListInput` union (CoreMessage / UIMessage / MastraDBMessage / arrays of any of those), which let callers pass shapes that didn't represent a single user turn (assistant role, tool-result parts, etc). The narrow type matches what a user turn can actually carry — text and inline file parts — and lets the signal pipeline drop a layer of shape detection.

`FilePart` uses `mimeType` (v4 naming) for consistency with the stored `MastraMessagePart` shape.

This is a breaking change for code that passed `CoreMessage` or `MastraDBMessage` shapes directly. The migration is:

```ts
// before
agent.sendSignal({ type: 'user-message', contents: { role: 'user', content: [{ type: 'text', text: 'hi' }] } });

// after
agent.sendSignal({ type: 'user-message', contents: [{ type: 'text', text: 'hi' }] });
// or for plain text
agent.sendSignal({ type: 'user-message', contents: 'hi' });
```

---
'@mastra/core': minor
---

Narrow `AgentSignalContents` (the `contents` field on signals) to `string | (TextPart | FilePart)[]` (v4 SDK `TextPart` / `FilePart`).

Previously the field accepted the full `BaseMessageListInput` union (CoreMessage / UIMessage / MastraDBMessage / arrays of any of those), which let callers pass shapes that didn't represent a single user turn (assistant role, tool-result parts, etc). The narrow type matches what a user turn can actually carry — text and inline file parts — and lets the signal pipeline drop a layer of shape detection.

`createSignal` now eagerly converts `contents` to canonical `MastraMessagePart[]` once at the boundary; all downstream projections (`toLLMMessage`, `toDBMessage`, `toDataPart`) read from the same walked representation. The `metadata.signal.contents` stash is no longer written — `content.parts` is the single source of truth for the payload, removing double-storage of file/image data. Round-trips read from `content.parts` with a legacy fallback for rows persisted before this change.

`FilePart` uses `mimeType` (v4 SDK naming), matching the rest of the persistence layer (`MastraMessagePart`).

This is a breaking change for code that passed `CoreMessage` or `MastraDBMessage` shapes directly. The migration is:

```ts
// before
agent.sendSignal({ type: 'user-message', contents: { role: 'user', content: [{ type: 'text', text: 'hi' }] } });

// after
agent.sendSignal({ type: 'user-message', contents: [{ type: 'text', text: 'hi' }] });
// or for plain text
agent.sendSignal({ type: 'user-message', contents: 'hi' });
```

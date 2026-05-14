---
'@mastra/core': minor
---

Narrow and simplify the `AgentSignalContents` type (the `contents` field on signals) to `string | (TextPart | FilePart)[]` (v4 SDK `TextPart` / `FilePart`).

**User-facing behavior changes**

- `user-message` signals now expose their `attributes` to the LLM. Previously `toLLMMessage()` short-circuited for user messages and dropped the wrapper, so attributes were invisible to the model even though they were correctly written to `toDataPart()` and DB metadata.
- Non-`user-message` signals (`system-reminder`, etc.) with multimodal `contents` now preserve their file parts in both the LLM prompt and DB storage. Previously these parts were flattened to text before either projection saw them.
- The `contents` field type is narrowed from `BaseMessageListInput` (CoreMessage / UIMessage / MastraDBMessage / arrays) to `string | (TextPart | FilePart)[]`. The previous wider type let callers pass shapes that didn't represent a single user turn (assistant role, tool-result parts, etc); the narrow type matches what a user turn can actually carry.

**Internals**

`createSignal` now eagerly converts `contents` once into a canonical `MastraMessagePart[]`; all downstream projections (`toLLMMessage`, `toDBMessage`, `toDataPart`) read from the same walked representation. The `metadata.signal.contents` stash is no longer written — `content.parts` is the single source of truth for the payload, removing double-storage of file data. Round-trips read from `content.parts` with a legacy fallback for rows persisted before this change.

`FilePart` uses `mimeType` (v4 SDK naming), matching the rest of the persistence layer (`MastraMessagePart`).

**Migration**

Breaking change for code that passed `CoreMessage` or `MastraDBMessage` shapes directly to `agent.sendSignal`:

```ts
// before
agent.sendSignal({ type: 'user-message', contents: { role: 'user', content: [{ type: 'text', text: 'hi' }] } });

// after
agent.sendSignal({ type: 'user-message', contents: 'hi' });
// or for multimodal
agent.sendSignal({ type: 'user-message', contents: [{ type: 'text', text: 'look' }, { type: 'file', data: '...', mimeType: 'image/png' }] });
```

Forward-compat note: new signal DB rows can now contain real multimodal `content.parts` (text + file). Consumers that walked signal rows assuming a single text part should handle the full parts array.

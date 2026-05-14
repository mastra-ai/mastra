---
'@mastra/core': patch
---

Two fixes to how signals reach the LLM and DB:

- `user-message` signals now expose their `attributes` to the LLM. Previously `toLLMMessage()` short-circuited and dropped the wrapper for user messages, so attributes were invisible to the model even though they were correctly written to `toDataPart()` and DB metadata.
- Non-`user-message` signals (`system-reminder`, etc.) with multimodal `contents` now preserve their file/image parts in both the LLM prompt and DB storage. Previously these parts were flattened to text before either projection saw them.

Internally, `createSignal` normalizes `contents` once into the canonical `MastraDBMessage[]` form, and both `toLLMMessage` and `toDBMessage` read from that. The external `signal.contents` value and `toDataPart()` output are unchanged.

Forward-compat note: new signal DB rows can now contain real multimodal `content.parts` (text + file/image), where before they were always a single text part. Consumers that walked signal rows assuming a single text part should be updated to handle the full parts array.

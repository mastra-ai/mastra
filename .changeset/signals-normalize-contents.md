---
'@mastra/core': patch
---

Signals now normalize `contents` to `MastraDBMessage[]` once at `createSignal` time (lazy + memoized) via MessageList's input conversion. Both `toLLMMessage` and `toDBMessage` read from this canonical form, fixing two gaps: `user-message` signals now surface their `attributes` to the LLM (inline-wrapped into the first text part), and non-`user-message` signals with multimodal contents (file/image parts) no longer get flattened to text — files survive into both the LLM prompt and DB persistence. The external `signal.contents` shape and `toDataPart` echo are unchanged.

Forward-compat note: new signal DB rows can now contain real multimodal `content.parts` (text + file/image), where before they were always a single text part. Consumers that walked signal rows assuming a single text part should be updated to handle the full parts array.

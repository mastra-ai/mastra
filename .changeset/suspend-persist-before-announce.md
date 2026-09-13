---
'@mastra/core': patch
---

Announce a tool-call suspension only after its snapshot is durable.

`approveToolCall()` / `resumeStream()` could reject a run that was genuinely suspended on the requested `toolCallId`:

```
AGENT_RESUME_TOOL_CALL_NOT_SUSPENDED
Agent "…" resumeStream() cannot resume tool call "…" because it is not suspended.
```

The agent loop emitted `tool-call-approval` *before* `suspend()`, so a caller that approved the moment the card rendered raced the snapshot write. `#validateSuspendedToolCallTarget` polls for a bounded 2s, which a multi-MB snapshot write outlives, so the approval was rejected even though the suspension landed moments later.

Suspension chunks are now emitted from a new `suspend({ onSuspendPersisted })` hook, fired once the suspended snapshot is persisted — so "this run is resumable by this id" is true at the moment the caller learns it, rather than by racing a poll.

Also adds `MastraModelOutput.markSuspended()`, so a step that defers its announcement still records the suspension in serialized stream state. Without it the resumed run resolved `text` from the last step alone and dropped the pre-gate text.

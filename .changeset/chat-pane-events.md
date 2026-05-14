---
'@mastra/core': minor
---

Harness v1 — chat-pane event types added.

- New per-turn events emitted while draining the agent's `fullStream`:
  - `message_start` / `message_update` / `message_end` carry the
    assistant `messageId` and incremental text (replaces the earlier
    `text_delta` shape, which had no consumers yet).
  - `tool_input_start` / `tool_input_delta` / `tool_input_end` carry
    model-side tool-argument streaming with `toolCallId` and
    `argsTextDelta`. `Session.getDisplayState().toolInputBuffers` is
    populated from these in lockstep.
  - `tool_update` added to the reserved-event list (emitter wiring lands
    with the built-in-tools slice).
- Reserved-event list in §6.2 / §10.2 updated to match.
- Spec §10 and the `Harness.subscribe()` doc-comment updated to describe
  the new event surface.

Internal-only API; no breaking changes.

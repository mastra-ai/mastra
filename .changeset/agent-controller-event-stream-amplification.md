---
'@mastra/core': patch
---

Stop AgentController sessions from re-sending the whole conversation state on every streamed chunk.

A session emits one `message_update` per streamed delta, and the session bus fanned out a full
`display_state_changed` snapshot alongside each one. Every snapshot carried the growing message plus
each finished tool's arguments and result, so a long turn with a large tool result re-sent that result
thousands of times. A turn with 500 deltas and a 100 KB tool result put roughly 50 MB of snapshots on
the wire; subscribers holding the event log could exhaust memory.

Snapshots for high-frequency events are now coalesced, so a burst of deltas produces one snapshot per
frame instead of one per delta. A snapshot always describes the complete current state, so no
information is lost: any dropped intermediate snapshot is immediately superseded, and a pending
snapshot is flushed before the next non-coalesced event so ordering and final state are unchanged.
The engine also skips its per-delta message clone when a session has no subscribers.

Event types, payload shapes, and delivery order are unchanged.

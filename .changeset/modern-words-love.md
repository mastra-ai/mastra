---
'@mastra/server': patch
---

Fixed HTTP agent observation to emit public stream frames instead of internal PubSub envelopes, restoring text, tool results, and finish metadata when reconnecting. Consumers that previously read observed chunks from event.data should now read the public frame directly (for example, event.payload.text). Raw PubSub events and inclusive replay offsets are unchanged.

---
'@mastra/core': patch
---

Fixed a bug where custom output processors could not emit stream events during final output processing. The `writer` object was always `undefined` when passed to output processors in the finish phase, preventing use cases like streaming moderation updates or custom UI events back to the client.

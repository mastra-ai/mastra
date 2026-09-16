---
'@mastra/memory': patch
---

Preserve observation-group provenance during reflection. Unordered numeric ranges now span by endpoint value instead of arrival order, so a reflected range is never persisted inverted, and each reflected section keeps the source ranges it actually drew from rather than only the one named in its heading. Reflected metadata stays compact: opaque message-ID segments are still spanned rather than accumulated.

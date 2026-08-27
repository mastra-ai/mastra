---
'@mastra/playground-ui': patch
---

Align the trace span search field with the span type legend

The search field took a row of its own directly above the timeline, leaving the legend row half empty. `TraceTimeline` now takes a `leadingSlot` rendered on the left of that legend row, and the trace panel puts the search field there. The legend row is kept alive by the slot alone, so a query matching nothing no longer unmounts the field along with the timeline.
